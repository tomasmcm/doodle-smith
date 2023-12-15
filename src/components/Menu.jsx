
import { motion } from 'framer-motion';

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

const Menu = ({ onClick, gameState }) => {

    return (
        <motion.div
            initial='hidden'
            animate={'visible'}
            variants={dropIn}
            exit="hidden"
            // animate={{ opacity:  }}
            className='absolute w-full h-full flex justify-center items-center flex-col px-8 text-center'
        >
            <img
                src="/bot.jpg"
                alt="Doodle Bot"
                className="mb-4 w-64 sm:w-80 rounded-xl"
            />
            <h1
                className='xl:text-8xl text-4xl mb-4 font-extrabold tracking-tight text-slate-900 text-center'>
                Doodle Smith
            </h1>

            <h2
                className='xl:text-2xl text-lg mb-3 font-semibold text-slate-900'>
                Can a neural network understand your doodles?<br/>
                If you get 10 right you win!
            </h2>

            <button
                onClick={onClick}
                disabled={gameState !== 'menu'}
                type="button"
                className={`
          inline-flex items-center px-4 py-2 font-semibold
          leading-6 shadow rounded-md text-white bg-lime-600 hover:bg-lime-500 hover:border-lime-700 focus:outline-lime-700
          transition ease-in-out duration-150 ${gameState === 'loading' ? "cursor-not-allowed" : ''}
          `}>
                {gameState === 'loading' && (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {gameState === 'loading' ? 'Loading neural network...' : 'Play Game'}
            </button>

        </motion.div>
    );
};

export default Menu;
