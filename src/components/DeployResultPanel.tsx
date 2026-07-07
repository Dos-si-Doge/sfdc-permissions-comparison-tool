import type { DeployResponse } from '../../server/apiTypes';

interface Props {
  result: DeployResponse;
  onDismiss: () => void;
}

export default function DeployResultPanel({ result, onDismiss }: Props) {
  return (
    <div className={result.success ? 'deploy-result deploy-result-success' : 'deploy-result deploy-result-failure'}>
      <div className="deploy-result-header">
        <strong>
          {result.checkOnly ? 'Validation' : 'Deploy'} {result.success ? 'succeeded' : 'failed'}
        </strong>
        <button onClick={onDismiss} aria-label="Dismiss result">
          ✕
        </button>
      </div>
      {result.message && <p className="deploy-result-message">{result.message}</p>}
      {result.componentResults.length > 0 && (
        <ul className="deploy-result-list">
          {result.componentResults.map((c, i) => (
            <li key={i} className={c.success ? 'deploy-result-row deploy-result-row-ok' : 'deploy-result-row deploy-result-row-bad'}>
              <span>{c.success ? '✓' : '✗'}</span>
              <span>{c.componentType}</span>
              <span>{c.fullName}</span>
              {c.problem && <span className="deploy-result-problem">{c.problem}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
