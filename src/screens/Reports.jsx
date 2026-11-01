import { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { ConfirmBar, Spinner } from '../components/ui.jsx';
import { BackIcon, LinkIcon } from '../components/Icons.jsx';
import { agoLong, linkParts } from '../lib/format.js';

// The admin's list of reported posts. Only the reported post is shown:
// the person who reported it chose to bring it forward.
export function Reports({ me, go }) {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const load = () => api.adminReports().then(setReports).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function deletePost(r) {
    await api.adminDeletePost(r.post_id);
    setConfirmId(null);
    await load();
  }
  async function dismiss(r) {
    await api.dismissReport(r.report_id);
    await load();
  }

  if (!me.is_admin) return <main className="page"><p className="error-note">Only the admin can see reports.</p></main>;

  return (
    <>
      <header className="topbar">
        <button className="icon-btn back" onClick={() => go("/")} aria-label="Back home"><BackIcon /></button>
      </header>
      <main className="page">
        <div className="home-intro">
          <h1>Reports</h1>
          <p>Posts friends have flagged. You see only the reported post.</p>
        </div>
        {error && <p className="error-note" role="alert">{error}</p>}
        {!reports && !error && <Spinner />}
        {reports && reports.length === 0 && <div className="empty"><p>No reports. All quiet.</p></div>}
        {reports && reports.map((r) => {
          const link = r.link_url && linkParts(r.link_url);
          return (
            <article key={r.report_id} className="report-card">
              <p className="report-who">
                <strong>{r.reporter_name}</strong> reported a post by <strong>{r.author_name}</strong>
                <span> · {agoLong(r.reported_at)}</span>
              </p>
              {r.note && <p className="report-note">“{r.note}”</p>}
              <blockquote className="report-post">
                {r.body && <p>{r.body}</p>}
                {link && <p className="report-link"><LinkIcon width={16} height={16} /> {link.host}{link.path}</p>}
                {r.photo_count > 0 && <p className="report-photos">{r.photo_count === 1 ? '1 photo' : `${r.photo_count} photos`} (not shown)</p>}
                <p className="report-posted">Posted {agoLong(r.posted_at)}</p>
              </blockquote>
              {confirmId === r.report_id ? (
                <ConfirmBar text={`Delete ${r.author_name.split(' ')[0]}’s post for good, with its photos, hearts and comments?`}
                  action="Delete post" onCancel={() => setConfirmId(null)} onConfirm={() => deletePost(r)} />
              ) : (
                <div className="row-end">
                  <button className="text-btn" onClick={() => dismiss(r)}>Dismiss</button>
                  <button className="danger-btn" onClick={() => setConfirmId(r.report_id)}>Delete post</button>
                </div>
              )}
            </article>
          );
        })}
      </main>
    </>
  );
}
