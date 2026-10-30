import cli from "../../scripts/lib/cli.cjs";
export function serializePolicyError(error) {
  return {
    code: error instanceof cli.CliError ? error.code : "POLICY_SIGNER",
    exitCode: error instanceof cli.CliError ? error.exitCode : 1,
    message: String(error.message).replace(/0x[0-9a-fA-F]{64}/g,"[hash]"),
    cliError: error instanceof cli.CliError,
  };
}
export function restorePolicyError(error) {
  return error.cliError
    ? new cli.CliError(error.code,error.message,[1,2,130,143].includes(error.exitCode) ? error.exitCode : 1)
    : Object.assign(new Error(error.message),{code:error.code});
}
