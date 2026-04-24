export default function TournamentBracket({ players, results }) {
  if (!players || players.length < 2) return null;

  const isFull = players.length >= 4;

  return (
    <div className="bracket-container" data-testid="tournament-bracket">
      <h2 className="bracket-title">TOURNAMENT BRACKET</h2>
      <div className="bracket-grid">
        <div className="bracket-round" data-testid="bracket-semifinals">
          <h3>SEMI-FINALS</h3>
          {isFull ? (
            <>
              <div className="bracket-match" data-testid="bracket-match-sf1">
                <div className="bracket-player">{players[0]?.name}</div>
                <span className="bracket-vs">VS</span>
                <div className="bracket-player">{players[1]?.name}</div>
              </div>
              <div className="bracket-match" data-testid="bracket-match-sf2">
                <div className="bracket-player">{players[2]?.name}</div>
                <span className="bracket-vs">VS</span>
                <div className="bracket-player">{players[3]?.name}</div>
              </div>
            </>
          ) : (
            <div className="bracket-match" data-testid="bracket-match-fight">
              <div className="bracket-player">{players[0]?.name}</div>
              <span className="bracket-vs">VS</span>
              <div className="bracket-player">{players[1]?.name || 'BOT'}</div>
            </div>
          )}
        </div>

        {isFull && (
          <div className="bracket-round" data-testid="bracket-finals">
            <h3>FINALS</h3>
            <div className="bracket-match">
              <div className="bracket-player tbd">
                {results?.sf1Winner || 'TBD'}
              </div>
              <span className="bracket-vs">VS</span>
              <div className="bracket-player tbd">
                {results?.sf2Winner || 'TBD'}
              </div>
            </div>
          </div>
        )}

        {results?.champion && (
          <div className="bracket-round" data-testid="bracket-champion">
            <h3>CHAMPION</h3>
            <div className="bracket-match champion">
              <div className="bracket-player winner">{results.champion}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
