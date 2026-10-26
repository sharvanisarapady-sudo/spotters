import { IconVideo } from './icons';

/** Returns an embeddable URL for YouTube/Vimeo links, or null for direct files. */
function toEmbed(url) {
  try {
    const u = new URL(url, window.location.origin);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v') || (u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : null);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export default function VideoPlayer({ videos }) {
  const list = (videos || []).filter((v) => v.video_url);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="font-display font-semibold text-sm tracking-wide uppercase text-navy-950 flex items-center gap-2">
        <IconVideo className="w-4 h-4 text-spotter-blue" />
        Video Explanation
      </h2>

      {list.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">Video explanation not available yet.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {list.map((v) => {
            const embed = toEmbed(v.video_url);
            return (
              <div key={v.id}>
                {v.title && <p className="text-sm font-medium text-navy-950 mb-2">{v.title}</p>}
                <div className="aspect-video rounded-xl overflow-hidden bg-navy-950">
                  {embed ? (
                    <iframe
                      src={embed}
                      title={v.title || 'Video explanation'}
                      className="w-full h-full"
                      allow="encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <video src={v.video_url} controls preload="metadata" className="w-full h-full" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
