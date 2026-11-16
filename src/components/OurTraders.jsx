import { useState } from "react";
import { Play, Youtube, Video } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { useSettings } from "../context/SettingsContext";
import { getReviewMedia, safeReviewImage, youtubeId } from "../lib/review-media";

function thumbFor(item, media) {
  const poster = safeReviewImage(item.poster || "");
  if (poster) return poster;
  if (media.kind === "youtube") {
    const id = youtubeId(media.url);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
  }
  return undefined;
}

function TraderCard({ item, onOpen, decorative }) {
  const media = getReviewMedia(item.url);
  const thumb = thumbFor(item, media);
  const source = media.kind === "youtube" ? "YouTube" : media.kind === "vimeo" ? "Vimeo" : "Video";
  return (
    <article className="trader-card" aria-hidden={decorative || undefined}>
      <button
        type="button"
        className="trader-card-media"
        onClick={() => onOpen(item)}
        tabIndex={decorative ? -1 : 0}
        aria-label={`Play ${item.name || "trader"}'s story`}
      >
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" />
        ) : media.kind === "video" ? (
          <video src={media.url} muted playsInline autoPlay loop preload="metadata" />
        ) : (
          <span className="trader-card-fallback">
            <Video />
          </span>
        )}
        <span className="trader-card-source">
          {media.kind === "youtube" ? <Youtube size={14} /> : <Video size={14} />}
          {source}
          {item.views ? ` • ${item.views}` : ""}
        </span>
        <span className="trader-card-play">
          <Play fill="currentColor" size={18} />
        </span>
      </button>
      <div className="trader-card-body">
        <h3 className="font-display">
          {item.flag ? <span aria-hidden="true">{item.flag} </span> : null}
          {item.name || "IndiFunded trader"}
        </h3>
        <p>{item.country || item.role || "India"}</p>
        <dl>
          <div>
            <dt>Rewards earned</dt>
            <dd>{item.rewards || "—"}</dd>
          </div>
          <div>
            <dt>Trading style</dt>
            <dd>{item.style || item.label || "—"}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

/** FTMO-style horizontal auto-scrolling trader video cards. Content comes from Admin → Site Settings → Review Videos. */
export default function OurTraders({ showEmpty = false, heading, subtitle }) {
  const { settings } = useSettings();
  const cfg = settings.video_reviews || {};
  const items = (cfg.items || []).filter(
    (item) => item.enabled !== false && getReviewMedia(item.url || ""),
  );
  const [active, setActive] = useState(null);
  const media = active ? getReviewMedia(active.url) : null;

  if (!items.length && !showEmpty) return null;
  const reps = Math.max(2, Math.ceil(8 / Math.max(items.length, 1)));
  const loop = Array.from({ length: reps * 2 }, () => items).flat();

  return (
    <section className="home-band our-traders-band" data-testid="our-traders">
      <div className="container-xl">
        <div className="home-section-heading">
          <div>
            <div className="home-eyebrow">Our traders</div>
            <h2 className="font-display">{heading || "Real traders. Real stories."}</h2>
            <p>
              {subtitle ||
                "Hear directly from IndiFunded traders about their journey, style and rewards."}
            </p>
          </div>
        </div>
      </div>
      {items.length ? (
        <div className="trader-marquee-wrap">
          <div
            className="trader-marquee"
            style={{ animationDuration: `${Math.max(30, items.length * reps * 7)}s` }}
          >
            {loop.map((item, i) => (
              <TraderCard key={i} item={item} onOpen={setActive} decorative={i >= items.length} />
            ))}
          </div>
        </div>
      ) : (
        <div className="container-xl">
          <div className="card-panel p-10 text-center text-[var(--muted)]">
            Trader video stories are coming soon.
          </div>
        </div>
      )}
      <Dialog
        open={!!active}
        onOpenChange={(v) => {
          if (!v) setActive(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogTitle>{active?.name || "Trader"}'s story</DialogTitle>
          <DialogDescription>
            {[active?.country, active?.style].filter(Boolean).join(" · ") ||
              "IndiFunded trading journey"}
          </DialogDescription>
          {media &&
            (media.kind === "video" ? (
              <video className="review-player" src={media.url} controls autoPlay playsInline />
            ) : (
              <iframe
                className="review-player"
                src={media.url}
                title={`${active?.name || "Trader"} video`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ))}
        </DialogContent>
      </Dialog>
    </section>
  );
}
