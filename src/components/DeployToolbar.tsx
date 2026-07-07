interface Props {
  selectedCount: number;
  selectedOrgUsername: string | null;
  deployAction: 'validate' | 'deploy' | null;
  onValidate: () => void;
  onDeploy: () => void;
}

export default function DeployToolbar({ selectedCount, selectedOrgUsername, deployAction, onValidate, onDeploy }: Props) {
  const disabled = selectedCount === 0 || !selectedOrgUsername || deployAction !== null;
  return (
    <div className="deploy-toolbar">
      <button onClick={onValidate} disabled={disabled}>
        {deployAction === 'validate' ? 'Validating…' : `Validate Selected (${selectedCount})`}
      </button>
      <button onClick={onDeploy} disabled={disabled}>
        {deployAction === 'deploy' ? 'Deploying…' : `Deploy Selected (${selectedCount})`}
      </button>
      {selectedCount > 0 && !selectedOrgUsername && <span className="reload-hint">Select an org above first.</span>}
    </div>
  );
}
