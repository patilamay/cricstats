// Loading animations for the Ask page, themed by what the question is about:
//   bowling  - a bowler runs in and hits the stumps (red bails fly)
//   batting  - a batter's backlift and lofted drive
//   fielding - a full-length diving catch
//   stadium  - floodlights and a ticking scoreboard (teams, results, totals, grounds)
// The caption is the accessible status; with reduced motion the picture stays still.

const BOWL = /\b(wickets?|bowl\w*|economy|five[- ]?(for|fers?|wicket)|5[- ]?(for|wkts?|wickets?)|figures|spells?|maidens?|dot balls?|hat[- ]?tricks?|spinners?|pacers?|seamers?|yorkers?|bouncers?|lbw|bowled)\b/i;
const FIELD = /\b(catch(es)?|caught|stumpings?|stumped|keepers?|wicket[- ]?keep\w*|run[- ]?outs?|fielders?|fielding|dismissals?)\b/i;
const BAT = /\b(runs?|centur(y|ies)|hundreds?|100s|fift(y|ies)|50s|sixes|six|fours|boundar(y|ies)|strike[- ]?rate|average|scores?|scored|innings|ducks?|batt(er|ers|ing|ed|sman|smen)|openers?|knocks?|double[- ]?hundreds?)\b/i;
const STADIUM = /\b(teams?|wins?|won|lost|loss(es)?|results?|record at|venues?|grounds?|stadiums?|toss|totals?|chases?|series|head[- ]?to[- ]?head|vs\.?|versus|matches played|world cup|finals?|champions?|titles?|draws?|tied?)\b/i;

// Picks a theme from the question (and the query, when known). Returns null when nothing matches.
export function themeOf(text = '', sql = '') {
  const t = `${text} ${sql}`;
  if (FIELD.test(t)) return 'fielding';
  if (/\bteam totals?\b|\blowest totals?\b|\bhighest totals?\b/i.test(t)) return 'stadium';
  const bowl = BOWL.test(text) || /\bbowling\b|\bwickets\b/i.test(sql);
  const bat = BAT.test(text);
  if (bowl && !bat) return 'bowling';
  if (bat && !bowl) return 'batting';
  if (bowl && bat) return /\bwickets?\b/i.test(text) ? 'bowling' : 'batting';
  if (STADIUM.test(text)) return 'stadium';
  return null;
}

const CAPTIONS = {
  batting: {
    'Working out the query': 'Taking guard…', 'Following on from the conversation': 'Next ball…',
    'Crunching the numbers': 'Picking the gap…', heavy: 'Watching every ball onto the bat…',
    'Adjusting the query': 'Reviewing the decision…', 'Writing the answer': 'Lofted over the top! Writing it up…',
  },
  bowling: {
    'Working out the query': 'Marking out the run-up…', 'Following on from the conversation': 'Back to the mark…',
    'Crunching the numbers': 'Running in…', heavy: 'Checking every delivery…',
    'Adjusting the query': 'Going upstairs to the third umpire…', 'Writing the answer': 'Bowled him! Writing it up…',
  },
  fielding: {
    'Working out the query': 'Setting the field…', 'Following on from the conversation': 'Moving a fielder…',
    'Crunching the numbers': 'Eyes on the ball…', heavy: 'Watching every chance…',
    'Adjusting the query': 'Checking it carried…', 'Writing the answer': 'Taken! Writing it up…',
  },
  stadium: {
    'Working out the query': 'Opening the gates…', 'Following on from the conversation': 'Back to the ground…',
    'Crunching the numbers': 'Totting up the scoreboard…', heavy: 'Going through every scorecard…',
    'Adjusting the query': 'Checking with the scorers…', 'Writing the answer': 'Full house! Writing it up…',
  },
};

const Stumps = ({ x }) => (
  <g className="pl-stumps-g">
    <rect className="pl-stump" x={x} y="62" width="5" height="38" rx="1.5" />
    <rect className="pl-stump" x={x + 8} y="62" width="5" height="38" rx="1.5" />
    <rect className="pl-stump" x={x + 16} y="62" width="5" height="38" rx="1.5" />
    <rect className="pl-bail b1" x={x - 1} y="58.5" width="11" height="3" rx="1.5" />
    <rect className="pl-bail b2" x={x + 11} y="58.5" width="11" height="3" rx="1.5" />
  </g>
);

function Batting() {
  return (
    <>
      <Stumps x={270} />
      <g className="pl-figure">
        <line x1="242" y1="78" x2="232" y2="100" />
        <line x1="242" y1="78" x2="254" y2="100" />
        <line x1="246" y1="52" x2="242" y2="78" />
        <circle className="pl-head" cx="247" cy="43" r="7" />
        <g className="bt-swing">
          <line x1="246" y1="55" x2="236" y2="66" />
          <rect className="pl-bat" x="233" y="63" width="7" height="32" rx="3" />
        </g>
      </g>
      <circle className="pl-ball bt-ball" r="4.5" />
    </>
  );
}

function Bowling() {
  return (
    <>
      <Stumps x={272} />
      <g className="bw-runner">
        <g className="pl-figure">
          <line className="bw-leg l1" x1="62" y1="74" x2="56" y2="100" />
          <line className="bw-leg l2" x1="62" y1="74" x2="70" y2="100" />
          <line x1="60" y1="48" x2="62" y2="74" />
          <line x1="60" y1="54" x2="48" y2="66" />
          <circle className="pl-head" cx="60" cy="40" r="7" />
          <g className="bw-arm"><line x1="60" y1="53" x2="60" y2="80" /></g>
        </g>
      </g>
      <circle className="pl-ball bw-ball" r="4.5" />
    </>
  );
}

function Fielding() {
  return (
    <>
      <g className="fd-dive">
        <g className="pl-figure">
          <line x1="200" y1="74" x2="192" y2="98" />
          <line x1="200" y1="74" x2="208" y2="98" />
          <line x1="200" y1="48" x2="200" y2="74" />
          <line x1="200" y1="54" x2="190" y2="40" />
          <line x1="200" y1="54" x2="196" y2="36" />
          <circle className="pl-head" cx="200" cy="40" r="7" />
        </g>
      </g>
      <circle className="pl-ball fd-ball" r="4.5" />
    </>
  );
}

function Stadium() {
  return (
    <>
      <path className="st-stand" d="M14 100 L30 58 Q160 34 290 58 L306 100 Z" />
      <path className="st-stand-front" d="M40 100 L52 74 Q160 58 268 74 L280 100 Z" />
      <ellipse className="st-field" cx="160" cy="100" rx="98" ry="10" />
      {[30, 290].map((x) => (
        <g key={x} className="st-tower">
          <line x1={x} y1="100" x2={x} y2="16" />
          <rect className="st-lamp" x={x - 11} y="8" width="22" height="10" rx="2" />
          <circle className="st-bulb" cx={x - 5} cy="13" r="2.4" />
          <circle className="st-bulb d2" cx={x + 1} cy="13" r="2.4" />
          <circle className="st-bulb d3" cx={x + 7} cy="13" r="2.4" />
        </g>
      ))}
      <rect className="st-board" x="122" y="14" width="76" height="28" rx="4" />
      <text className="st-score s1" x="160" y="33">124/2</text>
      <text className="st-score s2" x="160" y="33">128/2</text>
      <text className="st-score s3" x="160" y="33">134/2</text>
      <circle className="pl-ball st-ball" r="3.5" />
    </>
  );
}

const SCENES = { batting: Batting, bowling: Bowling, fielding: Fielding, stadium: Stadium };

export default function PitchLoader({ stage, theme = 'bowling', heavy = false, note }) {
  const t = SCENES[theme] ? theme : 'bowling';
  const Scene = SCENES[t];
  const caps = CAPTIONS[t];
  const caption = stage === 'Opening the conversation' ? 'Rolling back the tape…'
    : (heavy && stage === 'Crunching the numbers' ? caps.heavy : caps[stage]) || `${stage}…`;
  return (
    <div className={`pitch-loader theme-${t}`}>
      <svg viewBox="0 0 320 110" aria-hidden="true" className="pitch-svg">
        <rect className="pl-ground" x="0" y="100" width="320" height="4" rx="2" />
        <Scene />
      </svg>
      <p className="pitch-caption" role="status">{caption}{note && <span className="muted"> {note}</span>}</p>
    </div>
  );
}
