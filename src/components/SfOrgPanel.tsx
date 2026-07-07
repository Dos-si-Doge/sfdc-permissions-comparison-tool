import type { OrgSummary } from '../../server/apiTypes';

interface Props {
  orgs: OrgSummary[];
  orgsLoading: boolean;
  selectedOrgUsername: string | null;
  onSelectOrg: (username: string) => void;
  loginInFlight: boolean;
  loginError: string | undefined;
  onAddOrg: () => void;
  onCancelLogin: () => void;
  onRemoveOrg: (username: string) => void;
  removingUsername: string | null;
}

export default function SfOrgPanel({
  orgs,
  orgsLoading,
  selectedOrgUsername,
  onSelectOrg,
  loginInFlight,
  loginError,
  onAddOrg,
  onCancelLogin,
  onRemoveOrg,
  removingUsername,
}: Props) {
  return (
    <div className="sf-org-panel">
      <div className="sf-org-panel-header">
        <h3>Salesforce Orgs</h3>
        {loginInFlight ? (
          <span className="sf-org-login-waiting">
            Waiting for you to finish logging in in your browser…
            <button onClick={onCancelLogin}>Cancel</button>
          </span>
        ) : (
          <button onClick={onAddOrg}>+ Add Org</button>
        )}
      </div>
      {loginError && <p className="file-error">{loginError}</p>}
      {orgsLoading ? (
        <p className="hint">Loading orgs…</p>
      ) : orgs.length === 0 ? (
        <p className="hint">No orgs connected yet.</p>
      ) : (
        <ul className="sf-org-list">
          {orgs.map((org) => (
            <li key={org.orgId} className="sf-org-item">
              <label>
                <input type="radio" name="active-org" checked={org.username === selectedOrgUsername} onChange={() => onSelectOrg(org.username)} />
                <span className="sf-org-name">{org.alias ?? org.username}</span>
              </label>
              {org.likelyProduction && (
                <span
                  className="sf-org-badge-prod"
                  title="sf doesn't report a true production flag; this org isn't a sandbox or scratch org, which also matches Developer Edition/Trailhead orgs."
                >
                  PRODUCTION?
                </span>
              )}
              {org.connectedStatus && org.connectedStatus !== 'Connected' && (
                <span className="sf-org-badge-warn" title={`Connection status: ${org.connectedStatus}`}>
                  ⚠ {org.connectedStatus}
                </span>
              )}
              <button onClick={() => onRemoveOrg(org.username)} disabled={removingUsername === org.username} aria-label={`Remove org ${org.alias ?? org.username}`}>
                {removingUsername === org.username ? 'Removing…' : '✕'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
