import type { LeaderboardEntry } from '../net/types'

interface TagChaseHudProps {
  username: string
  holderLabel: string
  localScore: number
  leaderboard: LeaderboardEntry[]
  soundEnabled: boolean
  onToggleSound: () => void
}

export const TagChaseHud = ({
  username,
  holderLabel,
  localScore,
  leaderboard,
  soundEnabled,
  onToggleSound,
}: TagChaseHudProps) => (
  <div className="tag-hud">
    <div className="tag-hud__line">
      <span className="tag-hud__label">Player</span>
      <strong>{username}</strong>
    </div>
    <div className="tag-hud__line">
      <span className="tag-hud__label">Holder</span>
      <strong>{holderLabel}</strong>
    </div>
    <div className="tag-hud__line">
      <span className="tag-hud__label">My score</span>
      <strong>{localScore}</strong>
    </div>
    <div className="tag-hud__rank">
      <div className="tag-hud__rank-title">Top 3 (Best)</div>
      {leaderboard.length === 0 ? <div className="tag-hud__empty">No players</div> : null}
      {leaderboard.map((entry, index) => (
        <div key={entry.sessionId} className="tag-hud__rank-row">
          <span>{index + 1}. {entry.nickname}</span>
          <strong>{entry.score}</strong>
        </div>
      ))}
    </div>
    <button type="button" className="tag-hud__sound" onClick={onToggleSound}>
      Sound {soundEnabled ? 'ON' : 'OFF'}
    </button>
  </div>
)
