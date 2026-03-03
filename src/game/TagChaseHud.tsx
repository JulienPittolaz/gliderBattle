import type { LeaderboardEntry } from '../net/types'

interface TagChaseHudProps {
  username: string
  holderLabel: string
  localScore: number
  leaderboard: LeaderboardEntry[]
  compact?: boolean
}

export const TagChaseHud = ({
  username,
  holderLabel,
  localScore,
  leaderboard,
  compact = false,
}: TagChaseHudProps) => {
  const displayedLeaderboard = compact ? leaderboard.slice(0, 2) : leaderboard
  const leaderboardTitle = compact ? 'Top' : 'Top 3 (Best)'

  return (
    <div className={`tag-hud${compact ? ' tag-hud--compact' : ''}`}>
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
        <div className="tag-hud__rank-title">{leaderboardTitle}</div>
        {displayedLeaderboard.length === 0 ? <div className="tag-hud__empty">No players</div> : null}
        {displayedLeaderboard.map((entry, index) => (
          <div key={entry.sessionId} className="tag-hud__rank-row">
            <span>{index + 1}. {entry.nickname}</span>
            <strong>{entry.score}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
