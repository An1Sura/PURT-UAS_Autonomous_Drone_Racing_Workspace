import ADR.Benchmark
import Verification.Policy

/-! Audit adapted from CogniPilot GNC Verification.Policy (Apache-2.0).
Reject admitted proofs, custom axioms and unsafe declarations. The imported
GNC policy checks the loaded upstream modules; the same axiom traversal checks
our project declarations, including declarations outside the ADR namespace. -/
open Lean Elab Command in
run_cmd do
  let env ← getEnv
  match Verification.Policy.audit env with
  | .error message => throwError "GNC audit failed: {message}"
  | .ok _ => pure ()
  let mut names : Array Name := #[]
  let mut theorems := 0
  for (name, info) in env.constants.toList do
    if (`ADR).isPrefixOf (Verification.Policy.origin env name) || (`ADR).isPrefixOf name then
      if info.isAxiom || info.isUnsafe || info.isPartial then
        throwError "Unverified ADR declaration: {name}"
      if (env.checked.get.find? name).isNone then
        throwError "ADR declaration absent from checked environment: {name}"
      if (Compiler.getImplementedBy? env name).isSome || (getExternAttrData? env name).isSome then
        throwError "Unchecked ADR runtime replacement: {name}"
      names := names.push name
      match info with
      | .thmInfo _ => theorems := theorems + 1
      | _ => pure ()
  if theorems == 0 then throwError "No benchmark theorems found"
  let action : CollectAxioms.M Unit := names.forM CollectAxioms.collect
  let (_, state) := (action.run env).run {}
  for axiomName in state.axioms do
    unless #[``propext, ``Classical.choice, ``Quot.sound].contains axiomName do
      throwError "Forbidden benchmark axiom: {axiomName}"
  logInfo m!"ADR audit passed: {theorems} theorems; only propext, Classical.choice and Quot.sound permitted."
