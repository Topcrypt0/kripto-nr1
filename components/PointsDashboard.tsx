"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import {
  referralLink,
  usePointsProfile,
  useTrackPoints,
} from "@/lib/points/client";
import {
  OVERFLOW_RATE,
  REFERRAL_ACTIVATION_BONUS,
  REFERRAL_L1,
  REFERRAL_L2,
  REWARDS,
  SOURCES,
  STREAK_MAX,
  STREAK_STEP,
  TIERS,
  formatPoints,
  type PointsSource,
} from "@/lib/points/config";
import { PointsLeaderboard } from "@/components/PointsLeaderboard";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;

export function PointsDashboard() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { data, isLoading } = usePointsProfile(address);
  const track = useTrackPoints();
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const profile = data?.profile;
  const link = referralLink(address);

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      /* clipboard blocked — the input is selectable as a fallback */
    }
  }, [link]);

  // Perps fills have no single "action tx" the UI can hand us, so the wallet's
  // Hyperliquid history is replayed on demand from the stored cursor.
  const syncPerps = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    const res = await track({ source: "perps" });
    setSyncing(false);
    setSyncMsg(
      res
        ? res.awarded > 0
          ? `+${formatPoints(res.awarded)} points from ${res.details.length} fill(s)`
          : "No new fills since the last sync."
        : "Could not reach Hyperliquid — try again in a moment.",
    );
  }, [track]);

  if (!isConnected) {
    return (
      <section className="ptPanel ptConnect">
        <div className="ptConnectEmoji">✨</div>
        <h2 className="ptPanelTitle">Connect to see your points</h2>
        <p className="ptMuted">
          Every swap, bridge, perp fill, Earn deposit and rocket launch earns
          KRIPTO points — automatically, by volume. Connect the wallet you trade
          with.
        </p>
        <button
          className="pBtnPrimary"
          disabled={isPending}
          onClick={() => {
            const c =
              connectors.find((x) => x.id === "injected") ?? connectors[0];
            if (c) connect({ connector: c });
          }}
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>
        <EarnRules />
        <PointsLeaderboard />
      </section>
    );
  }

  return (
    <>
      {data && !data.durable && (
        <div className="ptWarn">
          ⚠️ No points database configured — totals are held in memory and reset
          on redeploy. Set <code>KV_REST_API_URL</code> and{" "}
          <code>KV_REST_API_TOKEN</code> to make them permanent.
        </div>
      )}

      {/* ---- hero ---- */}
      <section className="ptHero">
        <div className="ptHeroMain">
          <div className="ptHeroLabel">Your KRIPTO points</div>
          <div className="ptHeroValue">
            {isLoading ? "…" : formatPoints(profile?.total ?? 0)}
          </div>
          <div className="ptHeroMeta">
            <span
              className="ptTierChip"
              style={{
                color: profile?.tier.color,
                borderColor: `${profile?.tier.color}55`,
              }}
            >
              {profile?.tier.emoji} {profile?.tier.name ?? "Cadet"}
            </span>
            <span className="ptMuted">
              {profile?.rank
                ? `Rank #${profile.rank} of ${profile.players}`
                : "Unranked — earn your first points"}
            </span>
          </div>

          {profile?.next && (
            <div className="ptProgress">
              <div className="ptProgressBar">
                <span
                  style={{
                    width: `${Math.round(profile.progress * 100)}%`,
                    background: profile.next.color,
                  }}
                />
              </div>
              <div className="ptProgressLabel">
                {formatPoints(profile.next.min - profile.total)} points to{" "}
                {profile.next.emoji} {profile.next.name}
              </div>
            </div>
          )}
        </div>

        <div className="ptHeroSide">
          <Stat label="Volume tracked" value={usd(profile?.volumeUsd ?? 0)} />
          <Stat label="Actions" value={formatPoints(profile?.actions ?? 0)} />
          <Stat
            label="Streak"
            value={
              profile?.streak
                ? `🔥 ${profile.streak}d · ×${profile.multiplier.toFixed(2)}`
                : "—"
            }
          />
          <Stat
            label="Referral points"
            value={formatPoints(profile?.referral ?? 0)}
            tone="gold"
          />
        </div>
      </section>

      {/* ---- where the points came from ---- */}
      <section className="ptPanel">
        <div className="ptPanelHead">
          <h2 className="ptPanelTitle">📊 Points by product</h2>
          <button
            className="ptGhostBtn"
            onClick={syncPerps}
            disabled={syncing}
            title="Pull your latest Hyperliquid fills"
          >
            {syncing ? "Syncing…" : "↻ Sync perps"}
          </button>
        </div>
        {syncMsg && <div className="ptSyncMsg">{syncMsg}</div>}

        <div className="ptBars">
          {(profile?.breakdown ?? []).map((b) => {
            const max = Math.max(
              1,
              ...(profile?.breakdown ?? []).map((x) => x.points),
            );
            return (
              <div className="ptBarRow" key={b.source}>
                <Link href={b.href} className="ptBarLabel">
                  <span className="ptBarEmoji">{b.emoji}</span>
                  {b.label}
                </Link>
                <div className="ptBarTrack">
                  <span style={{ width: `${(b.points / max) * 100}%` }} />
                </div>
                <div className="ptBarValue">
                  <strong>{formatPoints(b.points)}</strong>
                  <span className="ptMuted">
                    {b.actions} · {usd(b.volumeUsd)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ptSplit">
          <span>
            From your trades:{" "}
            <strong>{formatPoints(profile?.base ?? 0)}</strong>
          </span>
          <span>
            From referrals:{" "}
            <strong>{formatPoints(profile?.referral ?? 0)}</strong>
          </span>
          <span>
            Bonuses: <strong>{formatPoints(profile?.bonus ?? 0)}</strong>
          </span>
        </div>
      </section>

      {/* ---- referrals ---- */}
      <section className="ptPanel">
        <div className="ptPanelHead">
          <h2 className="ptPanelTitle">👥 Invite &amp; earn</h2>
          <span className="ptPanelNote">
            {profile?.invitees ?? 0} invited
          </span>
        </div>
        <p className="ptMuted ptRefBlurb">
          Share your link. You earn{" "}
          <strong>{Math.round(REFERRAL_L1 * 100)}%</strong> of every point your
          invitees make — forever — plus{" "}
          <strong>{Math.round(REFERRAL_L2 * 100)}%</strong> from the people
          <em> they</em> invite. Their points are never reduced: yours are minted
          on top. Both of you also get{" "}
          <strong>+{formatPoints(REFERRAL_ACTIVATION_BONUS)}</strong> when they
          first earn.
        </p>
        <div className="ptRefRow">
          <input className="ptRefInput" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button className="pBtnPrimary ptRefBtn" onClick={copy}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
        {profile?.referrer && (
          <div className="ptRefNote">
            Invited by <code>{profile.referrer.slice(0, 10)}…</code>
          </div>
        )}
      </section>

      <EarnRules />

      {/* ---- what points buy ---- */}
      <section className="ptPanel">
        <div className="ptPanelHead">
          <h2 className="ptPanelTitle">🎁 What points get you</h2>
          <span className="ptPanelNote">Redemptions open at season end</span>
        </div>
        <div className="ptRewards">
          {REWARDS.map((r) => {
            const unlocked = (profile?.total ?? 0) >= (r.cost ?? 0);
            return (
              <div
                key={r.title}
                className={`ptReward${unlocked ? " ptRewardOn" : ""}`}
              >
                <div className="ptRewardTop">
                  <span className="ptRewardEmoji">{r.emoji}</span>
                  <span className="ptRewardCost">
                    {r.cost ? formatPoints(r.cost) : "—"} pts
                  </span>
                </div>
                <div className="ptRewardTitle">{r.title}</div>
                <div className="ptRewardDesc">{r.desc}</div>
                <div className="ptRewardState">
                  {unlocked ? "✅ Unlocked" : `Need ${formatPoints((r.cost ?? 0) - (profile?.total ?? 0))} more`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- tiers ---- */}
      <section className="ptPanel">
        <h2 className="ptPanelTitle">🎖️ Tiers</h2>
        <div className="ptTiers">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`ptTier${profile?.tier.name === t.name ? " ptTierOn" : ""}`}
              style={{ borderColor: profile?.tier.name === t.name ? t.color : undefined }}
            >
              <div className="ptTierHead" style={{ color: t.color }}>
                {t.emoji} {t.name}
              </div>
              <div className="ptTierMin">{formatPoints(t.min)}+ pts</div>
              <ul className="ptTierPerks">
                {t.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <PointsLeaderboard />
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold";
}) {
  return (
    <div className="ptStat">
      <div className="ptStatLabel">{label}</div>
      <div className={`ptStatValue${tone === "gold" ? " ptGold" : ""}`}>
        {value}
      </div>
    </div>
  );
}

/** The rulebook, rendered straight from the same config the engine scores with. */
function EarnRules() {
  return (
    <section className="ptPanel">
      <div className="ptPanelHead">
        <h2 className="ptPanelTitle">⚡ How to earn</h2>
        <span className="ptPanelNote">Points are awarded by volume</span>
      </div>
      <div className="ptTable">
        <div className="ptRow ptRowHead ptRules">
          <span>Action</span>
          <span>Rate</span>
          <span>First-time bonus</span>
          <span className="ptRight">Go</span>
        </div>
        {(Object.keys(SOURCES) as PointsSource[]).map((s) => {
          const r = SOURCES[s];
          return (
            <div className="ptRow ptRules" key={s}>
              <span>
                <strong>
                  {r.emoji} {r.label}
                </strong>
                <br />
                <span className="ptMuted ptSmall">{r.blurb}</span>
              </span>
              <span className="ptStrong">{r.rate} pts / $1</span>
              <span>+{formatPoints(r.firstBonus)}</span>
              <span className="ptRight">
                <Link href={r.href} className="ptGo">
                  Open →
                </Link>
              </span>
            </div>
          );
        })}
      </div>
      <ul className="ptFine">
        <li>
          Every action is verified server-side against the chain / the venue —
          points only exist for trades that actually settled.
        </li>
        <li>
          Volume above a product&apos;s soft cap in a single action still counts,
          at {Math.round(OVERFLOW_RATE * 100)}% of the rate, so one whale
          transaction can&apos;t own the board.
        </li>
        <li>
          Trade on consecutive days for a streak bonus: +
          {Math.round(STREAK_STEP * 100)}% per day, up to ×{STREAK_MAX}.
        </li>
      </ul>
    </section>
  );
}
