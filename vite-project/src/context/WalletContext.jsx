import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { ethers } from 'ethers';
import {
  contractAddress,
  contractABI,
  paymentTokenAddress,
  paymentTokenABI,
} from '../contactInfo.js';
import { useToast } from '../components/ui/Toast';

const WalletContext = createContext(null);
const SEPOLIA = 11155111;
const hasAddress = (value) =>
  ethers.isAddress(value || '') && value !== ethers.ZeroAddress;
const streamConfigured =
  hasAddress(contractAddress) && hasAddress(paymentTokenAddress);
const messageFor = (error) =>
  error?.code === 4001 || error?.code === 'ACTION_REJECTED'
    ? 'Request cancelled in your wallet.'
    : error?.code === -32002
    ? 'A wallet request is already open. Check your wallet to continue.'
    : (
        error?.shortMessage ||
        error?.message ||
        'The request failed. Please retry.'
      ).slice(0, 240);

export function WalletProvider({ children }) {
  const toast = useToast();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [status, setStatus] = useState('Not connected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [balanceError, setBalanceError] = useState('');
  const [incomingStreams, setIncomingStreams] = useState([]);
  const [outgoingStreams, setOutgoingStreams] = useState([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const session = useRef(0);
  const connecting = useRef(false);
  const processing = useRef(false);
  const contractWithProvider = useMemo(
    () =>
      provider && streamConfigured
        ? new ethers.Contract(contractAddress, contractABI, provider)
        : null,
    [provider]
  );
  const contractWithSigner = useMemo(
    () =>
      signer && streamConfigured
        ? new ethers.Contract(contractAddress, contractABI, signer)
        : null,
    [signer]
  );
  const getNetworkName = (id) =>
    id === SEPOLIA ? 'Ethereum Sepolia' : id ? `Chain ${id}` : 'Not connected';
  const disconnectWallet = useCallback(() => {
    session.current++;
    setProvider(null);
    setSigner(null);
    setWalletAddress(null);
    setChainId(null);
    setTokenBalance(null);
    setIncomingStreams([]);
    setOutgoingStreams([]);
    setStreamError('');
    setBalanceError('');
    setConnectionError('');
    setIsInitialLoad(true);
    setIsLoadingStreams(false);
    setStatus('Disconnected from AgentPay');
  }, []);
  const connectWallet = async () => {
    if (connecting.current) return;
    if (!window.ethereum) {
      const message =
        'No browser wallet detected. Open AgentPay in a wallet-enabled browser to connect.';
      setConnectionError(message);
      toast.info(message, { title: 'Wallet needed' });
      return;
    }
    const epoch = ++session.current;
    connecting.current = true;
    setIsConnecting(true);
    setConnectionError('');
    try {
      const eth = window.ethereum;
      await eth.request({ method: 'eth_requestAccounts' });
      if (Number(await eth.request({ method: 'eth_chainId' })) !== SEPOLIA) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          });
        } catch (error) {
          if (error.code !== 4902) throw error;
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xaa36a7',
                chainName: 'Ethereum Sepolia',
                nativeCurrency: {
                  name: 'Sepolia ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          });
        }
      }
      if (Number(await eth.request({ method: 'eth_chainId' })) !== SEPOLIA)
        throw new Error(
          'Switch your wallet to Ethereum Sepolia and reconnect.'
        );
      const nextProvider = new ethers.BrowserProvider(eth);
      const nextSigner = await nextProvider.getSigner();
      const address = await nextSigner.getAddress();
      if (session.current !== epoch) return;
      setProvider(nextProvider);
      setSigner(nextSigner);
      setWalletAddress(address);
      setChainId(SEPOLIA);
      setIsInitialLoad(streamConfigured);
      setStatus('Connected to Ethereum Sepolia');
    } catch (error) {
      if (session.current === epoch) {
        setConnectionError(messageFor(error));
        toast.error(messageFor(error), { title: 'Connection not completed' });
      }
    } finally {
      connecting.current = false;
      setIsConnecting(false);
    }
  };
  useEffect(() => {
    if (!walletAddress || !window.ethereum?.on) return;
    const changed = () => {
      disconnectWallet();
      setConnectionError(
        'Your wallet account or network changed. Reconnect to refresh the active session.'
      );
    };
    const eth = window.ethereum;
    eth.on('accountsChanged', changed);
    eth.on('chainChanged', changed);
    eth.on('disconnect', changed);
    return () => {
      eth.removeListener?.('accountsChanged', changed);
      eth.removeListener?.('chainChanged', changed);
      eth.removeListener?.('disconnect', changed);
    };
  }, [walletAddress, disconnectWallet]);

  const fetchTokenBalance = useCallback(async () => {
    if (!provider || !walletAddress || !streamConfigured) return;
    const epoch = session.current;
    try {
      const token = new ethers.Contract(
        paymentTokenAddress,
        paymentTokenABI,
        provider
      );
      if ((await token.decimals()) !== 18n)
        throw new Error(
          'Legacy streams require 18-decimal tUSD. Use USDC only in the guarded path.'
        );
      const balance = await token.balanceOf(walletAddress);
      if (epoch === session.current) {
        setTokenBalance(ethers.formatEther(balance));
        setBalanceError('');
      }
    } catch (error) {
      if (epoch === session.current) {
        setTokenBalance(null);
        setBalanceError(messageFor(error));
      }
    }
  }, [provider, walletAddress]);
  const refreshStreams = useCallback(async () => {
    if (!walletAddress || !contractWithProvider || !provider) return;
    const epoch = session.current;
    setIsLoadingStreams(true);
    setStreamError('');
    try {
      const latest = await provider.getBlockNumber();
      const events = await contractWithProvider.queryFilter(
        contractWithProvider.filters.StreamCreated(),
        Math.max(0, latest - 49000),
        latest
      );
      // Ignore unrelated parties before making per-stream RPC calls.
      const mine = events.filter((ev) =>
        [ev.args.sender, ev.args.recipient].some(
          (a) => a.toLowerCase() === walletAddress.toLowerCase()
        )
      );
      const streams = await Promise.all(
        mine.map(async (ev) => {
          const s = await contractWithProvider.streams(ev.args.streamId);
          return {
            id: ev.args.streamId.toString(),
            sender: s.sender,
            recipient: s.recipient,
            totalAmount: s.totalAmount,
            flowRate: s.flowRate,
            startTime: Number(s.startTime),
            stopTime: Number(s.stopTime),
            amountWithdrawn: s.amountWithdrawn,
            isActive: s.isActive,
          };
        })
      );
      if (epoch !== session.current) return;
      setIncomingStreams(
        streams.filter(
          (s) => s.recipient.toLowerCase() === walletAddress.toLowerCase()
        )
      );
      setOutgoingStreams(
        streams.filter(
          (s) => s.sender.toLowerCase() === walletAddress.toLowerCase()
        )
      );
    } catch (error) {
      if (epoch === session.current) setStreamError(messageFor(error));
    } finally {
      if (epoch === session.current) {
        setIsLoadingStreams(false);
        setIsInitialLoad(false);
      }
    }
  }, [walletAddress, contractWithProvider, provider]);
  useEffect(() => {
    if (!walletAddress || !contractWithProvider) return;
    refreshStreams();
    fetchTokenBalance();
    const changed = () => {
      refreshStreams();
      fetchTokenBalance();
    };
    const names = ['StreamCreated', 'StreamCancelled', 'Withdrawn'];
    names.forEach((name) => {
      contractWithProvider.on(name, changed).catch(() => {});
    });
    return () => {
      names.forEach((name) => {
        contractWithProvider.off(name, changed).catch(() => {});
      });
    };
  }, [walletAddress, contractWithProvider, refreshStreams, fetchTokenBalance]);

  const transact = async (label, action) => {
    if (processing.current) return null;
    processing.current = true;
    setIsProcessing(true);
    let pending;
    const epoch = session.current;
    const assertSession = () => {
      if (epoch !== session.current)
        throw new Error(
          'Wallet session changed. Reconnect before starting another transaction.'
        );
    };
    try {
      if (!signer || !streamConfigured)
        throw new Error(
          'Connect a wallet and configure the legacy stream contracts first.'
        );
      if (
        Number(await window.ethereum.request({ method: 'eth_chainId' })) !==
        SEPOLIA
      )
        throw new Error(
          'Switch to Ethereum Sepolia and reconnect before signing.'
        );
      assertSession();
      setStatus(label);
      pending = toast.transaction.pending(label);
      const result = await action(assertSession);
      if (epoch === session.current) {
        setStatus('Transaction confirmed');
        toast.success('Transaction confirmed on Sepolia.');
        await Promise.all([refreshStreams(), fetchTokenBalance()]);
      }
      return result;
    } catch (error) {
      setStatus(messageFor(error));
      toast.error(messageFor(error), { title: 'Transaction not completed' });
      return null;
    } finally {
      if (pending) toast.dismiss(pending);
      processing.current = false;
      setIsProcessing(false);
    }
  };
  const mintPaymentTokens = (amount = '1000') =>
    transact(
      'Confirm test tUSD mint in your wallet…',
      async (assertSession) => {
        const token = new ethers.Contract(
          paymentTokenAddress,
          paymentTokenABI,
          signer
        );
        if ((await token.decimals()) !== 18n)
          throw new Error(
            'USDC uses Circle’s faucet, not legacy tUSD minting.'
          );
        assertSession();
        return (
          await token.mint(walletAddress, ethers.parseEther(amount))
        ).wait();
      }
    );
  const withdraw = (id) =>
    transact('Confirm withdrawal in your wallet…', async () =>
      (await contractWithSigner.withdrawFromStream(id)).wait()
    );
  const cancel = (id) =>
    transact('Confirm stream cancellation in your wallet…', async () =>
      (await contractWithSigner.cancelStream(id)).wait()
    );
  const createStream = async (recipient, duration, amount) => {
    const result = await transact(
      'Preparing stream. Check your wallet…',
      async (assertSession) => {
        if (!hasAddress(recipient))
          throw new Error('Enter a nonzero Ethereum recipient address.');
        const total = ethers.parseEther(amount.toString());
        const dur = Number(duration);
        if (
          total <= 0n ||
          !Number.isSafeInteger(dur) ||
          dur < 1 ||
          total / BigInt(dur) === 0n
        )
          throw new Error(
            'Use a positive amount and whole-second duration with a nonzero flow rate.'
          );
        const token = new ethers.Contract(
          paymentTokenAddress,
          paymentTokenABI,
          signer
        );
        if ((await token.decimals()) !== 18n)
          throw new Error(
            'Legacy streams require 18 decimals. USDC belongs to the guarded path.'
          );
        if (
          (await contractWithSigner.paymentToken()).toLowerCase() !==
          paymentTokenAddress.toLowerCase()
        )
          throw new Error('Stream token configuration mismatch.');
        if ((await token.balanceOf(walletAddress)) < total)
          throw new Error(
            'Not enough tUSD for this stream. Mint test tUSD or lower the amount.'
          );
        if ((await token.allowance(walletAddress, contractAddress)) < total) {
          assertSession();
          setStatus('Step 1 of 2: approve tUSD in your wallet…');
          await (await token.approve(contractAddress, total)).wait();
        }
        assertSession();
        setStatus('Step 2 of 2: confirm stream creation…');
        const receipt = await (
          await contractWithSigner.createStream(recipient, dur, total, '{}')
        ).wait();
        let id = null;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== contractAddress.toLowerCase())
            continue;
          try {
            const parsed = contractWithSigner.interface.parseLog(log);
            if (parsed?.name === 'StreamCreated')
              id = parsed.args.streamId.toString();
          } catch {
            /* Other event. */
          }
        }
        return { id, confirmed: true };
      }
    );
    return result;
  };
  const getClaimableBalance = async (id) => {
    if (!contractWithProvider)
      throw new Error('Connect a wallet and configure stream contracts first.');
    if (!/^[1-9][0-9]*$/.test(String(id)))
      throw new Error('Enter a positive whole-number stream ID.');
    const s = await contractWithProvider.streams(id);
    if (s.recipient.toLowerCase() !== walletAddress.toLowerCase())
      throw new Error('Only the stream recipient can withdraw these funds.');
    return ethers.formatEther(
      await contractWithProvider.getClaimableBalance(id)
    );
  };
  const formatEth = (value) => {
    try {
      return ethers.formatEther(value);
    } catch {
      return '0';
    }
  };
  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        walletAddress,
        chainId,
        status,
        setStatus,
        isConnecting,
        connectionError,
        disconnectWallet,
        isProcessing,
        tokenBalance,
        balanceError,
        incomingStreams,
        outgoingStreams,
        isLoadingStreams,
        streamError,
        isInitialLoad,
        streamConfigured,
        contractWithProvider,
        contractWithSigner,
        getNetworkName,
        connectWallet,
        fetchTokenBalance,
        mintPaymentTokens,
        refreshStreams,
        withdraw,
        cancel,
        createStream,
        getClaimableBalance,
        formatEth,
        toast,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
