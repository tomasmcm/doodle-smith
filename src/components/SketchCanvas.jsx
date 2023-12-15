

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { throttle } from '../utils.js';

import constants from '../constants.js';

const START_DRAW_EVENTS = ['mousedown', 'touchstart'];
const DRAW_EVENTS = ['mousemove', 'touchmove'];
const STOP_DRAW_EVENTS = ['mouseup', 'mouseout', 'touchend'];

const THROTTLE_MS = 10; // number of milliseconds to throttle drawing by

// Ensure the canvas is at least as large as the screen
const CANVAS_SIZE = Math.max(window.screen.width, window.screen.height);

const SKETCH_PADDING = 4; // number of pixels around the sketch

const addEventListeners = (item, events, fn) => {
  for (let event of events) {
    item.addEventListener(event, fn);
  }
}

const removeEventListeners = (item, events, fn) => {
  for (let event of events) {
    item.removeEventListener(event, fn);
  }
}

const getPosition = (event) => {
  if (event.touches && event.touches[0]) {
    // Account for "safe area" on iPhones (i.e., notch)
    const diff = (event.target.offsetHeight - document.body.offsetHeight) / 2;
    return [event.touches[0].clientX, event.touches[0].clientY - diff]
  } else {
    return [event.offsetX, event.offsetY];
  }
}


const SketchCanvas = forwardRef(({
  onSketchChange, disabled
}, ref) => {

  // const [disabled, setDisabled] = useState(false);

  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [sketchBoundingBox, setSketchBoundingBox] = useState(null); // [x1, y1, x2, y2]
  const [isDrawing, setIsDrawing] = useState(false);

  const [timeSpentDrawing, setTimeSpentDrawing] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!contextRef.current) {
      // Set up the canvas context on initial render
      // NOTE: We set `willReadFrequently` to true to improve performance.
      contextRef.current = canvas.getContext('2d', { willReadFrequently: true });
    }

    const context = contextRef.current;

    // Setup the brush
    context.imageSmoothingEnabled = true;
    context.lineWidth = constants.BRUSH_SIZE;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = 'black';
    context.shadowColor = 'rgba(0, 0, 0, 0.9)'; // Set shadow color
    context.shadowBlur = 1; // Set shadow blur

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const marginX = canvasWidth * 0.1;
    const marginY = canvasHeight * 0.1;
    const paddingLeft = (canvasWidth - window.innerWidth) / 2;
    const paddingTop = (canvasHeight - window.innerHeight) / 2;

    const brushRadius = constants.BRUSH_SIZE / 2;

    const handleResize = () => {
      // NOTE: We adjust the style's width and height to avoid clearing the canvas data. 
      canvas.style.width = window.innerWidth;
      canvas.style.height = window.innerHeight;
    };

    const startDrawing = (event) => {
      if (disabled) return;

      // if (event.button !== 0) return; // Only draw on left click
      const [offsetX, offsetY] = getPosition(event);
      const canvasX = offsetX + paddingLeft;
      const canvasY = offsetY + paddingTop;

      // Ignore glitches
      if (
        canvasX < marginX ||
        canvasY < marginY ||
        canvasX > canvasWidth - marginX ||
        canvasY > canvasHeight - marginY
      ) {
        return;
      }
      context.moveTo(canvasX, canvasY);
      context.beginPath();
      context.lineTo(canvasX, canvasY);

      // NOTE: Due to a bug with iOS, we just draw a dot on touchstart events
      context.arc(canvasX, canvasY, 0.5, 0, 2 * Math.PI);
      context.stroke();

      setIsDrawing(true);

      setSketchBoundingBox(x => x === null
        ? [canvasX, canvasY, canvasX, canvasY]
        : [
          Math.min(x[0], canvasX - brushRadius),
          Math.min(x[1], canvasY - brushRadius),
          Math.max(x[2], canvasX + brushRadius),
          Math.max(x[3], canvasY + brushRadius),
        ]
      );
      onSketchChange();
    };

    const draw = throttle((event) => {
      if (!isDrawing || disabled) return;

      setTimeSpentDrawing(x => x + THROTTLE_MS)

      const [offsetX, offsetY] = getPosition(event);
      const canvasX = offsetX + paddingLeft;
      const canvasY = offsetY + paddingTop;

      // Ignore glitches
      if (
        canvasX < marginX ||
        canvasY < marginY ||
        canvasX > canvasWidth - marginX ||
        canvasY > canvasHeight - marginY
      ) {
        return;
      }

      setSketchBoundingBox(x => x === null ? x : [
        Math.min(x[0], canvasX - brushRadius),
        Math.min(x[1], canvasY - brushRadius),
        Math.max(x[2], canvasX + brushRadius),
        Math.max(x[3], canvasY + brushRadius),
      ]);

      context.lineTo(canvasX, canvasY);
      context.stroke();
      onSketchChange();
    }, THROTTLE_MS);

    const stopDrawing = () => {
      setIsDrawing(false);
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    addEventListeners(canvas, START_DRAW_EVENTS, startDrawing);
    addEventListeners(canvas, DRAW_EVENTS, draw);
    addEventListeners(canvas, STOP_DRAW_EVENTS, stopDrawing);

    return () => {
      window.removeEventListener('resize', handleResize);

      removeEventListeners(canvas, START_DRAW_EVENTS, startDrawing);
      removeEventListeners(canvas, DRAW_EVENTS, draw);
      removeEventListeners(canvas, STOP_DRAW_EVENTS, stopDrawing);
    };
  }, [isDrawing, onSketchChange, disabled]);


  const getCanvasData = () => {
    if (sketchBoundingBox === null) return null;

    const context = contextRef.current;

    // Ensure sketch is square (and that aspect ratio is maintained)
    let left = sketchBoundingBox[0];
    let top = sketchBoundingBox[1];
    let width = sketchBoundingBox[2] - sketchBoundingBox[0];
    let height = sketchBoundingBox[3] - sketchBoundingBox[1];
    let sketchSize = 2 * SKETCH_PADDING;

    // Center the crop
    if (width >= height) {
      sketchSize += width;
      top = Math.max(top - (width - height) / 2, 0);
    } else {
      sketchSize += height;
      left = Math.max(left - (height - width) / 2, 0);
    }

    const imgData = context.getImageData(left - SKETCH_PADDING, top - SKETCH_PADDING, sketchSize, sketchSize);

    // DEBUG:
    // context.putImageData(imgData, 1920 / 2, 1920 / 2)
    // context.strokeRect(1920 / 2, 1920 / 2, sketchSize, sketchSize);

    return imgData;
  };

  const clearCanvas = (resetTimeSpentDrawing = false) => {
    setSketchBoundingBox(null);
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setIsDrawing(false);

    if (resetTimeSpentDrawing) {
      setTimeSpentDrawing(0);
    }
  };

  // Expose the getCanvasData/clearCanvas functions to the parent component
  useImperativeHandle(ref, () => ({
    getCanvasData: getCanvasData,
    clearCanvas: clearCanvas,
    getTimeSpentDrawing: () => timeSpentDrawing,
  }));

  return (
    <canvas
      className='object-none w-full h-full'
      ref={canvasRef}

      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
    />
  );
});
SketchCanvas.displayName = 'SketchCanvas'; // Add the display name

export default SketchCanvas;
