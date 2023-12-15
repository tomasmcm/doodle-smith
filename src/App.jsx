import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css'
import SketchCanvas from './components/SketchCanvas'
import constants from './constants'
import Menu from './components/Menu';
import GameOver from './components/GameOver';
import Countdown from './components/Countdown';
import Correct from './components/Correct';

import { AnimatePresence } from 'framer-motion'

import { formatTime } from './utils.js';

// https://stackoverflow.com/a/12646864/13989043
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function App() {

  // Model loading
  const [ready, setReady] = useState(false);

  // Game state
  const [gameState, setGameState] = useState('menu');
  const [countdown, setCountdown] = useState(constants.COUNTDOWN_TIMER);
  const [gameCurrentTime, setGameCurrentTime] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [output, setOutput] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [sketchHasChanged, setSketchHasChanged] = useState(false);
  const [lives, setLives] = useState(constants.LIVES);
  const [levelTimer, setLevelTimer] = useState(constants.LEVEL_TIMER);

  // What the user must sketch
  const [targets, setTargets] = useState(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [predictions, setPredictions] = useState([]);
  const [correct, setCorrect] = useState(false);
  const [modelResponses, setModelResponses] = useState(constants.RESPONSES);

  // Create a reference to the worker object.
  const worker = useRef(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      const result = e.data;

      switch (result.status) {

        case 'ready':
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          beginCountdown();
          break;

        case 'update':
          // Generation update: update the output text.
          break;

        case 'result':
          // TODO optimize:

          setIsPredicting(false);

          {
            const filteredResult = result.data.filter(x => !constants.BANNED_LABELS.includes(x.label));
            const timespent = canvasRef.current.getTimeSpentDrawing();

            // Slowly start rejecting labels that are not the target
            const applyEasyMode = timespent - constants.REJECT_TIME_DELAY;
            if (applyEasyMode > 0 && filteredResult[0].score > constants.START_REJECT_THRESHOLD) {

              // The number of labels to reject
              let amount = applyEasyMode / constants.REJECT_TIME_PER_LABEL;

              for (let i = 0; i < filteredResult.length && i < amount + 1; ++i) {
                if (filteredResult[i].label === targets[targetIndex]) {
                  // The target label should not be rejected
                  continue;
                }
                if (amount > i) {
                  filteredResult[i].score = 0;
                } else {
                  // fractional amount
                  filteredResult[i].score *= (i - amount);
                }
              }

              // sort again
              filteredResult.sort((a, b) => b.score - a.score);
            }

            // Normalize to be a probability distribution
            const sum = filteredResult.reduce((acc, x) => acc + x.score, 0);
            filteredResult.forEach(x => x.score /= sum);

            setOutput(filteredResult);
          }
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);
    // worker.current.addEventListener('error', alert);

    // Define a cleanup function for when the component is unmounted.
    return () => worker.current.removeEventListener('message', onMessageReceived);
  });

  // Set up classify function
  const classify = useCallback(() => {
    if (worker.current && canvasRef.current) {
      const image = canvasRef.current.getCanvasData();
      if (image !== null) {
        setIsPredicting(true);
        worker.current.postMessage({ action: 'classify', image })
      }
    }
  }, []);

  const canvasRef = useRef(null);

  const handleEndGame = (cancelled = false) => {
    endGame(cancelled);
  };

  const handleClearCanvas = (resetTimeSpentDrawing = false) => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas(resetTimeSpentDrawing);
    }
  };

  const beginCountdown = () => {
    setGameState('countdown');
    setLives(constants.LIVES);

    // Choose the targets here and shuffle
    const possibleLabels = Object.values(constants.LABELS)
      .filter(x => !constants.BANNED_LABELS.includes(x));
    shuffleArray(possibleLabels);

    setTargets(possibleLabels);
    setTargetIndex(0);
    const responses = constants.RESPONSES
    shuffleArray(responses);
    setModelResponses(responses);
  }

  const handleMainClick = () => {
    if (!ready) {
      setGameState('loading');
      worker.current.postMessage({ action: 'load' })
    } else {
      beginCountdown();
    }
  };

  const handleGameOverClick = (playAgain) => {
    if (playAgain) {
      beginCountdown();
    } else {
      endGame(true);
    }
  };

  // Detect for start of game
  useEffect(() => {
    if (gameState === 'countdown' && countdown <= 0) {
      setGameStartTime(performance.now());
      setPredictions([]);
      setGameState('playing');
    }
  }, [gameState, countdown])

  const addPrediction = useCallback((isCorrect) => {
    // take snapshot of canvas
    const image = canvasRef.current.getCanvasData();

    setPredictions(prev => [...prev, {
      output: output?.[0] ?? null,
      image: image,
      correct: isCorrect,
      target: targets[targetIndex],
    }]);
  }, [output, targetIndex, targets]);

  const endGame = useCallback((cancelled = false) => {
    // if (!cancelled) {
    //   addPrediction(false);
    // }

    // reset
    setOutput(null);
    setSketchHasChanged(false);
    handleClearCanvas(true);
    setCountdown(constants.COUNTDOWN_TIMER);
    setGameState(cancelled ? 'menu' : 'end');
    setLives(constants.LIVES)
  }, []);

  // Detect for end of game
  useEffect(() => {
    if (
      gameState === 'playing' &&
      // gameCurrentTime !== null &&
      // gameStartTime !== null &&
      // (gameCurrentTime - gameStartTime) / 1000 > constants.GAME_DURATION
      lives <= 0
    ) {
      endGame();
    }
  }, [endGame, gameState, gameStartTime, gameCurrentTime, lives])


  const goNext = useCallback((isCorrect = false) => {
    if (!isCorrect) {
      // apply skip penalty (done by pretending the game started earlier)
      // setGameStartTime(prev => {
      //   return prev - constants.SKIP_PENALTY
      // });
      setLives(lives => (lives - 1))
    } else {
      setLevelTimer(prev => (prev - constants.LEVEL_TIMER_REDUCER))
    }
    if (lives > 0) {
      addPrediction(isCorrect);
    }

    setTargetIndex(prev => prev + 1);
    setOutput(null);
    setSketchHasChanged(false);
    handleClearCanvas(true);
  }, [addPrediction, lives])

  // detect for correct and go onto next
  useEffect(() => {
    if (gameState === 'playing' && output !== null && targets !== null) {
      // console.log(targets[targetIndex], output[0])

      if (targets[targetIndex] === output[0].label) {
        // Correct! Switch to next
        setCorrect(true);
        goNext(true);
        setTimeout(() => {
          setCorrect(false);
        }, 400);
      }
    }
  }, [goNext, gameState, output, targets, targetIndex]);

  // GAME LOOP:
  useEffect(() => {
    if (gameState === 'countdown') {
      const countdownTimer = setInterval(() => {
        setCountdown((prevCount) => prevCount - 1);
      }, 1000);

      return () => {
        clearInterval(countdownTimer);
      };
    } else if (gameState === 'playing') {

      const classifyTimer = setInterval(() => {
        if (sketchHasChanged) {
          !isPredicting && classify();
        }
        setSketchHasChanged(false);

        setGameCurrentTime(performance.now());
      }, constants.PREDICTION_REFRESH_TIME);

      return () => {
        clearInterval(classifyTimer);
      };
    } else if (gameState === 'end') {
      // The game ended naturally (after timer expired)
      handleClearCanvas(true);
    }
  }, [gameState, isPredicting, sketchHasChanged, addPrediction, classify]);

  const checkLevelTime = () => {
    const currentTime = canvasRef?.current?.getTimeSpentDrawing() || 0;
    if ( (levelTimer - currentTime) < 0) {
      goNext(false);
    }
  }

  useEffect(() => {
    if (gameState === 'playing') {
      const preventDefault = (e) => e.preventDefault();
      document.addEventListener('touchmove', preventDefault, { passive: false });
      return () => {
        document.removeEventListener('touchmove', preventDefault, { passive: false });
      }
    }
  }, [gameState]);
  const menuVisible = gameState === 'menu' || gameState === 'loading';
  const isPlaying = gameState === 'playing';
  const countdownVisible = gameState === 'countdown';
  const gameOver = gameState === 'end';
  const timeSpent = Math.max(
    0,
    levelTimer - (canvasRef?.current?.getTimeSpentDrawing() || 0)
  ) / levelTimer * 100;

  return (
    <>
      <div className={`h-full w-full top-0 left-0 absolute ${isPlaying ? '' : 'pointer-events-none'}`}>
        <SketchCanvas onSketchChange={() => {
          setSketchHasChanged(true);
          checkLevelTime();
        }} ref={canvasRef} />
      </div>
      <AnimatePresence
        initial={false}
        mode='wait'
      >
        {menuVisible && (
          <Menu gameState={gameState} onClick={handleMainClick} />
        )}
      </AnimatePresence>

      <AnimatePresence
        initial={false}
        mode='wait'
      >
        {countdownVisible && (
          <Countdown countdown={countdown} />
        )}
      </AnimatePresence>

      <AnimatePresence
        initial={false}
        mode='wait'
      >
        {gameOver && (
          <GameOver predictions={predictions} onClick={handleGameOverClick} gameCurrentTime={gameCurrentTime} gameStartTime={gameStartTime}/>
        )}
      </AnimatePresence>

      <AnimatePresence
        initial={false}
        mode='wait'
      >
        {correct && (
          <Correct />
        )}
      </AnimatePresence>

      {((isPlaying && gameCurrentTime !== null && targets)) && (

        <div className='absolute top-5 text-center text-slate-900'>
          <h2 className='text-4xl font-semibold mb-3'>
            Draw:&nbsp;
            <span className="rounded-lg bg-lime-50 p-2 shadow-lg w-auto inline-block px-4">{targets[targetIndex]}</span>
          </h2>
          <div className='w-[80vw] h-2 bg-gray-300 rounded-full overflow-hidden mb-2'>
            <div className='h-full bg-lime-500' style={{ width: `${timeSpent}%` }}></div>
          </div>
          <h3 className='text-xl font-medium mb-1'>
            Time: {formatTime((gameCurrentTime - gameStartTime) / 1000)}
          </h3>
          <h3 className='text-xl font-medium'>
            Lives: {'❤️ '.repeat(lives)}
          </h3>
        </div>
      )}

      {menuVisible && (
        <div className='absolute bottom-4 text-center'>
          This game is running 100% locally on this device. <br/>
          Made with{" "}
          <a
            className='underline text-lime-600'
            href='https://github.com/xenova/transformers.js'
          >
            🤗 Transformers.js
          </a>
        </div>
      )}

      {isPlaying && (
        <div className='absolute bottom-5 text-center'>

          <h1 className="text-2xl font-bold mb-3">
            {output && `${modelResponses[targetIndex % modelResponses.length]} ${output[0].label} (${(100 * output[0].score).toFixed(1)}%)`}
          </h1>

          <div className='flex gap-2 justify-center'>
            <button className="text-lime-900 font-semibold hover:border-lime-700 focus:outline-lime-700" onClick={() => { handleClearCanvas() }}>Clear</button>
            <button className="text-lime-900 font-semibold hover:border-lime-700 focus:outline-lime-700" onClick={() => { goNext(false) }}>Skip</button>
            <button className="text-lime-900 font-semibold hover:border-lime-700 focus:outline-lime-700" onClick={() => { handleEndGame(true) }}>Exit</button>
          </div>
        </div>
      )}
    </>
  )
}

export default App
