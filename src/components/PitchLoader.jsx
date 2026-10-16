// Loading animations for the Ask page. "quick": the logo's stumps get bowled.
// "long": a full delivery (ball pitches, bat swings, six) for heavy, ball-by-ball questions.
// The caption is the accessible status; with reduced motion the picture stays still.

const CAPTIONS = {
  quick: {
    'Working out the query': 'Taking guard…',
    'Following on from the conversation': 'Next ball…',
    'Crunching the numbers': 'Bowling it in…',
    'Adjusting the query': 'Reviewing the decision…',
    'Writing the answer': 'Bails off! Writing it up…',
    'Opening the conversation': 'Rolling back the tape…',
  },
  long: {
    'Working out the query': 'Marking out the run-up…',
    'Following on from the conversation': 'New over…',
    'Crunching the numbers': 'Checking every ball…',
    'Adjusting the query': 'Going upstairs to the third umpire…',
    'Writing the answer': 'Six! Writing it up…',
    'Opening the conversation': 'Rolling back the tape…',
  },
};

export default function PitchLoader({ stage, mode = 'quick', note }) {
  const caption = (CAPTIONS[mode] && CAPTIONS[mode][stage]) || `${stage}…`;
  return (
    <div className={`pitch-loader ${mode}`}>
      <svg viewBox="0 0 220 84" aria-hidden="true" className="pitch-svg">
        <rect className="pl-pitch" x="0" y="74" width="220" height="4" rx="2" />
        {mode === 'long' && <rect className="pl-crease" x="156" y="70" width="2" height="12" rx="1" />}
        <g className="pl-stumps">
          <rect x="166" y="40" width="5" height="34" rx="1.5" />
          <rect x="174" y="40" width="5" height="34" rx="1.5" />
          <rect x="182" y="40" width="5" height="34" rx="1.5" />
        </g>
        <rect className="pl-bail b1" x="165" y="36.5" width="11" height="3" rx="1.5" />
        <rect className="pl-bail b2" x="177" y="36.5" width="11" height="3" rx="1.5" />
        {mode === 'long' && (
          <g className="pl-bat">
            <rect x="143" y="16" width="4" height="16" rx="2" className="pl-handle" />
            <rect x="141" y="31" width="8" height="34" rx="3.5" />
          </g>
        )}
        <circle className="pl-ball" cx="0" cy="0" r="4.5" />
      </svg>
      <p className="pitch-caption" role="status">{caption}{note && <span className="muted"> {note}</span>}</p>
    </div>
  );
}
