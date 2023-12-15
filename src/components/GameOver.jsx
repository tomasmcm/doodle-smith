
import { motion } from 'framer-motion';
import { formatTime } from '../utils.js';

const dropIn = {
    hidden: {
        y: "-100vh",
        transition: {
            delay: 0.1,
            type: "spring",
            damping: 10,
            stiffness: 100,
        },
    },
    visible: {
        y: "0",
        opacity: 1,
        transition: {
            type: "spring",
            damping: 10,
            stiffness: 100,
        },
    }
};

function createImageFromImageData(imageData) {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Set the canvas dimensions to match the ImageData dimensions
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    // Put the ImageData onto the canvas
    context.putImageData(imageData, 0, 0);

    // // Create a new image element
    // const image = new Image();

    // // Set the source of the image to the canvas data
    // image.src = canvas.toDataURL();

    return canvas.toDataURL();
}


const GameOver = ({ predictions, onClick, gameCurrentTime, gameStartTime }) => {

    console.log('predictions', predictions)
    const correct = predictions.filter(p => p.correct).length

    return (
        <motion.div
            initial='hidden'
            animate={'visible'}
            variants={dropIn}
            exit="hidden"
            // animate={{ opacity:  }}
            className='absolute w-full h-full flex items-center flex-col p-8 text-center overflow-y-scroll'
        >
            <h1
                className='sm:text-7xl text-6xl mb-3 font-bold tracking-tight text-slate-900 text-center'>
                {correct >= 10 ? "You Won!" : "Game Over!"}
            </h1>

            {correct >= 10 && (
                <>
                    <h3 className='mb-4 sm:text-2xl text-xl font-semibold text-slate-900'>
                        As an award, here is a picture of you in broccoli-land!
                    </h3>
                    <img
                        src="/mamedeGPT.png"
                        alt="You Won!"
                        className="mb-4 w-80 rounded-xl"
                    />
                </>
            )}

            <h2
                className='sm:text-2xl text-xl font-semibold text-slate-900'>
                Score: {correct} / {predictions.length}
            </h2>

            <h3 className='mb-4 sm:text-2xl text-xl font-semibold text-slate-900'>
                Time: {formatTime((gameCurrentTime - gameStartTime) / 1000)}
            </h3>

            <div
                className='grid grid-cols-4 gap-4 px-8 p-4 rounded-lg shadow-[0_5px_25px_-5px_rgb(0,0,0,0.1),_0_8px_10px_-6px_rgb(0,0,0,0.1);] overflow-y-scroll h-[16rem] shrink-0'
            >
                {predictions.map((p, i) => {
                    return (
                        <div
                            key={i}
                            className='flex justify-center items-center w-full flex-col'
                        >


                            <img className='max-h-[12rem] w-[12rem]' src={p.image ? createImageFromImageData(p.image) : ''}></img>

                            <p className='text-slate-900 text-xs sm:text-lg font-semibold mt-2'>{p.target} {p.correct ? '✅' : '❌'}</p>
                        </div>
                    )
                })}
            </div>

            <div className='flex mt-6 gap-4'>
                <button
                    onClick={() => onClick(true)}
                    type="button"
                    className={`
          inline-flex items-center px-4 py-2 font-semibold
          leading-6 shadow rounded-md text-white bg-lime-600 hover:bg-lime-500 hover:border-lime-700 focus:outline-lime-700
          transition ease-in-out duration-150
          `}>
                    Play Again
                </button>
                <button
                    onClick={() => onClick(false)}
                    type="button"
                    className={`
    inline-flex items-center px-4 py-2 font-semibold
    leading-6 shadow rounded-md text-lime-900 hover:border-lime-700 focus:outline-lime-700
    transition ease-in-out duration-150
  `}
                >
                    Main Menu
                </button>

            </div>
        </motion.div>
    );
};

export default GameOver;
