import type { NormalizedFile } from '../lib/types';

interface Props {
  files: NormalizedFile[];
}

export default function ProfileOnlySection({ files }: Props) {
  const profilesWithData = files.filter((f) => f.profileOnly.length > 0);
  if (profilesWithData.length === 0) {
    return <p className="profile-only-empty">No profile-only fields to show (no profiles loaded, or none of the loaded profiles use these fields).</p>;
  }

  return (
    <div className="profile-only-section">
      <p className="profile-only-note">
        These fields exist only on Profiles and have no Permission Set equivalent, so they cannot be diffed across
        files — shown here per-file for reference.
      </p>
      {profilesWithData.map((file) => (
        <div key={file.id} className="profile-only-file">
          <h3>{file.name}</h3>
          {file.profileOnly.map((section) => (
            <div key={section.label} className="profile-only-group">
              <h4>{section.label}</h4>
              <ul>
                {section.entries.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
