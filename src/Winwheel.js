/**
 * Winwheel.js rewritten in ES6 class
 * which will be compiled down to ES5
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2012-2019 Douglas McKechie
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import defaults from 'lodash/defaults';
import includes from 'lodash/includes';
import isNil from 'lodash/isNil';
import isEmpty from 'lodash/isEmpty';
import pullAt from 'lodash/pullAt';
import TweenMax from 'gsap/TweenMax';
import Animation from './Animation';
import Pin from './Pin';
import Segment from './Segment';
import PointerGuide from './PointerGuide';
import { degToRad } from './utils';
import { DIRECTION, DRAW_MODE } from './constants';

class Winwheel {
  defaultOptions = {
    canvasId          : 'canvas',     // Id of the canvas which the wheel is to draw on to.
    canvasElement     : null,         // element of the canvas to draw on to.
    centerX           : null,         // X position of the center of the wheel. The default of these are null which means will be placed in center of the canvas.
    centerY           : null,         // Y position of the wheel center. If left null at time of construct the center of the canvas is used.
    outerRadius       : null,         // The radius of the outside of the wheel. If left null it will be set to the radius from the center of the canvas to its shortest side.
    innerRadius       : 0,            // Normally 0. Allows the creation of rings / doughnuts if set to value > 0. Should not exceed outer radius.
    animation         : null,         // customize animation
    pins              : null,         // customize pin
    pointerGuide      : null,         // customize pointer guide
    numSegments       : 1,            // The number of segments. Need at least one to draw.
    drawMode          : 'code',       // The draw mode. Possible values are 'code', 'image', 'segmentImage'. Default is code which means segments are drawn using canvas arc() function.
    rotationAngle     : 0,            // The angle of rotation of the wheel - 0 is 12 o'clock position.
    textFontFamily    : 'Arial',      // Segment text font, you should use web safe fonts.
    textFontSize      : 20,           // Size of the segment text.
    textFontWeight    : 'bold',       // Font weight.
    textOrientation   : 'horizontal', // Either horizontal, vertical, or curved.
    textAlignment     : 'center',     // Either center, inner, or outer.
    textDirection     : 'normal',     // Either normal or reversed. In normal mode for horizontal text in segment at 3 o'clock is correct way up, in reversed text at 9 o'clock segment is correct way up.
    textMargin        : null,         // Margin between the inner or outer of the wheel (depends on textAlignment).
    textFillStyle     : 'black',      // This is basically the text colour.
    textStrokeStyle   : null,         // Basically the line colour for segment text, only looks good for large text so off by default.
    textLineWidth     : 1,            // Width of the lines around the text. Even though this defaults to 1, a line is only drawn if textStrokeStyle specified.
    fillStyle         : 'silver',     // The segment background colour.
    strokeStyle       : 'black',      // Segment line colour. Again segment lines only drawn if this is specified.
    lineWidth         : 1,            // Width of lines around segments.
    clearTheCanvas    : true,         // When set to true the canvas will be cleared before the wheel is drawn.
    imageOverlay      : false,        // If set to true in image drawing mode the outline of the segments will be displayed over the image. Does nothing in code drawMode.
    drawText          : true,         // By default the text of the segments is rendered in code drawMode and not in image drawMode.
    pointerAngle      : 0,            // Location of the pointer that indicates the prize when wheel has stopped. Default is 0 so the (corrected) 12 o'clock position.
    wheelImage        : null,         // Must be set to image data in order to use image to draw the wheel - drawMode must also be 'image'.
    imageDirection    : 'N',          // Used when drawMode is segmentImage. Default is north, can also be (E)ast, (S)outh, (W)est.
    responsive        : false,        // If set to true the wheel will resize when the window first loads and also onResize.
    scaleFactor       : 1,            // Set by the responsive function. Used in many calculations to scale the wheel.
  };

  constructor(options = {}, drawWheel = true) {
    this.options = defaults(options, this.defaultOptions);
    this.drawWheel = drawWheel;
    this.winwheelAlreadyDrawn = false;
    this.canvas = null;
    this.ctx = null;
    this.segments = [];
    this.animation = null;
    this.pins = null;
    this.pointerGuide = null;

    // If the text margin is null then set to same as font size as we want some by default.
    if (this.options.textMargin === null) {
      this.options.textMargin = this.options.textFontSize / 1.7;
    }

    this.initiateCanvas();
    this.initiateSegments();
    this.initiateAnimation();
    this.initiatePin();
    this.initiateDrawMode();
    this.initiatePointerGuide();
    this.initiateResponsive();
    this.initiateDrawWheel();
  }


  /**
   * If the id of the canvas is set, try to get the canvas as we need it for drawing.
   */
  initiateCanvas = () => {
    if (this.options.canvasElement) {
      this.canvas = this.options.canvasElement;
    } else if (this.options.canvasId) {
      this.canvas = document.getElementById(this.options.canvasId);

      if (!this.canvas) {
        this.canvas = null;
        this.ctx = null;
        return;
      }
    } else {
      this.canvas = null;
      this.ctx = null;
      return;
    }

    // If the centerX and centerY have not been specified in the options then default to center of the canvas
    // and make the outerRadius half of the canvas width - this means the wheel will fill the canvas.
    if (this.options.centerX == null) {
      this.options.centerX = this.canvas.width / 2;
    }

    if (this.options.centerY == null) {
      this.options.centerY = this.canvas.height / 2;
    }

    if (this.options.outerRadius == null) {
      // Need to set to half the width of the shortest dimension of the canvas as the canvas may not be square.
      // Minus the line segment line width otherwise the lines around the segments on the top,left,bottom,right
      // side are chopped by the edge of the canvas.
      if (this.canvas.width < this.canvas.height) {
        this.options.outerRadius = (this.canvas.width / 2) - this.options.lineWidth;
      } else {
        this.options.outerRadius = (this.canvas.height / 2) - this.options.lineWidth;
      }
    }

    // Also get a 2D context to the canvas as we need this to draw with.
    this.ctx = this.canvas.getContext('2d');
  };

  /**
   * This function sorts out the segment sizes. Some segments may have set sizes, for the others what is left out of
   * 360 degrees is shared evenly. What this function actually does is set the start and end angle of the arcs.
   */
  initiateSegments = () => {
    this.segments = [];

    for (let i = 0; i < this.options.numSegments; i++) {
      if (this.options.segments && this.options.segments[i]) {
        this.segments[i] = new Segment(this.options.segments[i], { handleImageLoad: this.winwheelLoadedImage });
      } else {
        this.segments[i] = new Segment(null, { handleImageLoad: this.winwheelLoadedImage });
      }
    }

    this.updateSegmentSizes();
  };

  /**
   * If the animation options have been passed in then create animation object as a property of this class
   * and pass the options to it so the animation is set. Otherwise create default animation object.
   */
  initiateAnimation = () => {
    this.animation = new Animation(this.options.animation);
  };

  /**
   * If some pin options then create create a pin object and then pass them in.
   */
  initiatePin = () => {
    if (!this.options.pins) return;
    this.pins = new Pin(this.options.pins);
  };

  /**
   * If the drawMode is image change some defaults provided a value has not been specified.
   */
  initiateDrawMode = () => {
    if (includes([DRAW_MODE.IMAGE, DRAW_MODE.SEGMENT_IMAGE], this.options.drawMode)) {
      // Remove grey fillStyle.
      if (!this.options.fillStyle) {
        this.options.fillStyle = null;
      }

      // Set strokeStyle to red.
      if (isNil(this.options.strokeStyle)) {
        this.strokeStyle = 'red';
      }

      // Set drawText to false as we will assume any text is part of the image.
      if (isNil(this.options.drawText)) {
        this.options.drawText = false;
      }

      // Also set the lineWidth to 1 so that segment overlay will look correct.
      if (isNil(this.options.lineWidth)) {
        this.options.lineWidth = 1;
      }

      // Set drawWheel to false as normally the image needs to be loaded first.
      if (isNil(this.drawWheel)) {
        this.drawWheel = false;
      }
    } else {
      // When in code drawMode the default is the wheel will draw.
      if (isNil(this.drawWheel)) {
        this.drawWheel = true;
      }
    }
  };

  initiatePointerGuide = () => {
    this.pointerGuide = new PointerGuide(this.options.pointerGuide);
  };

  /**
   * Check if the wheel is to be responsive, if so then need to save the original size of the canvas
   * and also check for data- attributes on the canvas which help control the scaling.
   */
  initiateResponsive = () => {
    if (!this.options.responsive) return;

    // Save the original defined width and height of the canvas, this is needed later to work out the scaling.
    this._originalCanvasWidth = this.canvas.width;
    this._originalCanvasHeight = this.canvas.height;

    // Get data-attributes on the canvas.
    this._responsiveScaleHeight = this.canvas.dataset.responsivescaleheight;
    this._responsiveMinWidth = this.canvas.dataset.responsiveminwidth;
    this._responsiveMinHeight = this.canvas.dataset.responsiveminheight;
    this._responsiveMargin = this.canvas.dataset.responsivemargin;

    // Add event listeners for onload and onresize and call a function defined at the bottom
    // of this script which will handle that and work out the scale factor.
    window.addEventListener('load', this.winwheelResize);
    window.addEventListener('resize', this.winwheelResize);
  };

  initiateDrawWheel = () => {
    if (this.drawWheel) return this.draw(this.options.clearTheCanvas);

    if (this.options.drawMode === DRAW_MODE.SEGMENT_IMAGE) {
      // If segment image then loop though all the segments and load the images for them setting a callback
      // which will call the draw function of the wheel once all the images have been loaded.
      this.winwheelAlreadyDrawn = false;

      // If segment image then loop though all the segments and load the images for them setting a callback
      // which will call the draw function of the wheel once all the images have been loaded.
      this.segments.forEach((segment) => segment.renderImage());
    }
  };

  /**
   * This function clears the canvas. Will wipe anything else which happens to be drawn on it.
   */
  clearCanvas = () => {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  /**
   * This function takes an image such as PNG and draws it on the canvas making its center at the centerX and center for the wheel.
   */
  drawWheelImage = () => {
    // Double check the wheelImage property of this class is not null. This does not actually detect that an image
    // source was set and actually loaded so might get error if this is not the case. This is why the initial call
    // to draw() should be done from a wheelImage.onload callback as detailed in example documentation.
    if (isNil(this.options.wheelImage)) return;

    // Get the centerX and centerY in to variables, adjust by the scaleFactor.
    const centerX = this.options.centerX * this.options.scaleFactor;
    const centerY = this.options.centerY * this.options.scaleFactor;

    // Get the scaled width and height of the image.
    const scaledWidth = this.options.wheelImage.width * this.options.scaleFactor;
    const scaledHeight = this.options.wheelImage.height * this.options.scaleFactor;

    // Work out the correct X and Y to draw the image at. We need to get the center point of the image
    // aligned over the center point of the wheel, we can't just place it at 0, 0.
    const imageLeft = centerX - (scaledWidth / 2);
    const imageTop  = centerY - (scaledHeight / 2);

    // Rotate and then draw the wheel.
    // We must rotate by the rotationAngle before drawing to ensure that image wheels will spin.
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(degToRad(this.options.rotationAngle));
    this.ctx.translate(-centerX, -centerY);

    // Draw the image passing the scaled width and height which will ensure the image will be responsive.
    this.ctx.drawImage(this.options.wheelImage, imageLeft, imageTop, scaledWidth, scaledHeight);

    this.ctx.restore();
  };


  /**
   * Draws the pins around the outside of the wheel.
   */
  drawPins = () => {
    if (!this.pins) return;

    // Get scaled centerX and centerY to use in the code below so pins will draw responsively too.
    const centerX = this.options.centerX * this.options.scaleFactor;
    const centerY = this.options.centerY * this.options.scaleFactor;
    const outerRadius = this.options.outerRadius * this.options.scaleFactor;

    return this.pins.draw({
      context: this.ctx,
      centerX,
      centerY,
      outerRadius,
      defaultOptions: this.options,
    });
  };

  /**
   * Draws a line from the center of the wheel to the outside at the angle where the code thinks the pointer is.
   */
  drawPointerGuide = () =>
    this.pointerGuide.draw({
      context: this.ctx,
      centerX: this.options.centerX,
      centerY: this.options.centerY,
      scaleFactor: this.options.scaleFactor,
      outerRadius: this.options.outerRadius,
      pointerAngle: this.options.outerRadius,
    });

  drawSegmentImages = () => {
    if (!this.ctx || !this.segments) return;

    // Get the centerX and centerY of the wheel adjusted with the scale factor.
    let centerX = this.options.centerX * this.options.scaleFactor;
    let centerY = this.options.centerY * this.options.scaleFactor;

    this.segments.forEach((segment, index) => {
      try {
        segment.drawImage({
          context: this.ctx,
          centerX,
          centerY,
          scaleFactor: this.options.scaleFactor,
          rotationAngle: this.options.rotationAngle,
          defaultDirection: this.options.imageDirection,
        });
      } catch (err) {
        console.error(`Segment ${index}: ${err.message}`);
      }
    });
  };

  /**
   * This function draws the wheel on the page by rendering the segments on the canvas.
   */
  drawSegments = () => {
    if (!this.ctx || !this.segments) return;

    // Get scaled centerX and centerY and also scaled inner and outer radius.
    const centerX = this.options.centerX * this.options.scaleFactor;
    const centerY = (this.options.centerY * this.options.scaleFactor);
    const innerRadius = (this.options.innerRadius * this.options.scaleFactor);
    const outerRadius = (this.options.outerRadius * this.options.scaleFactor);

    this.segments.forEach((segment) => {
      segment.draw({
        context: this.ctx,
        centerX,
        centerY,
        innerRadius,
        outerRadius,
        defaultOptions: this.options,
      });
    });
  };

  /**
   * This draws the text on the segments using the specified text options.
   */
  drawSegmentText = () => {
    if (!this.ctx) return;

    // Get the centerX and centerY scaled with the scale factor, also the same for outer and inner radius.
    let centerX = (this.options.centerX * this.options.scaleFactor);
    let centerY = (this.options.centerY * this.options.scaleFactor);
    let outerRadius = (this.options.outerRadius * this.options.scaleFactor);
    let innerRadius = (this.options.innerRadius * this.options.scaleFactor);

    this.segments.forEach((segment) => {
      // Save the context so it is certain that each segment text option will not affect the other.
      this.ctx.save();

      segment.drawText({
        context: this.ctx,
        centerX,
        centerY,
        outerRadius,
        innerRadius,
        defaultOptions: this.options,
      });

      // Restore so all text options are reset ready for the next text.
      this.ctx.restore();
    });
  };

  /**
   * This function draws / re-draws the wheel on the canvas therefore rendering any changes.
   *
   * @param {boolean} clearTheCanvas
   */
  draw = (clearTheCanvas = true) => {
    if (!this.ctx) return;

    // Clear the canvas, unless told not to.
    if (clearTheCanvas) this.clearCanvas();

    // Call functions to draw the segments and then segment text.
    switch (this.options.drawMode) {
      case DRAW_MODE.IMAGE: {
        // Draw the wheel by loading and drawing an image such as a png on the canvas.
        this.drawWheelImage();

        // If we are to draw the text, do so before the overlay is drawn
        // as this allows the overlay to be used to create some interesting effects.
        if (this.options.drawText) {
          this.drawSegmentText();
        }

        // If image overlay is true then call function to draw the segments over the top of the image.
        // This is useful during development to check alignment between where the code thinks the segments are and where they appear on the image.
        if (this.options.imageOverlay) {
          this.drawSegments();
        }

        break;
      }

      case DRAW_MODE.SEGMENT_IMAGE: {
        // Draw the wheel by rendering the image for each segment.
        this.drawSegmentImages();

        // If we are to draw the text, do so before the overlay is drawn
        // as this allows the overlay to be used to create some interesting effects.
        if (this.options.drawText) {
          this.drawSegmentText();
        }

        // If image overlay is true then call function to draw the segments over the top of the image.
        // This is useful during development to check alignment between where the code thinks the segments are and where they appear on the image.
        if (this.options.imageOverlay) {
          this.drawSegments();
        }

        break;
      }

      default: {
        // The default operation is to draw the segments using code via the canvas arc() method.
        // nothing to do here
        this.drawSegments();

        // If we are to draw the text, do so before the overlay is drawn
        // as this allows the overlay to be used to create some interesting effects.
        if (this.options.drawText) {
          this.drawSegmentText();
        }
      }
    }

    // If this class has pins and visible then draw them
    if (this.pins && this.pins.isVisible()) {
      this.drawPins();
    }

    // If pointer guide is display property is set to true then call function to draw the pointer guide.
    if (this.pointerGuide.isVisible()) {
      this.drawPointerGuide();
    }
  };

  setCenter = (x, y) => {
    this.options.centerX = x;
    this.options.centerY = y;
  };

  /**
   * This function allows a segment to be added to the wheel. The position of the segment is optional,
   * if not specified the new segment will be added to the end of the wheel.
   *
   * @param {Object} options
   * @param {number|null} position start from 0
   * @returns {Segment}
   */
  addSegment = (options, position = null) => {
    // Create a new segment object passing the options in.
    const newSegment = new Segment(options, { handleImageLoad: this.winwheelLoadedImage });

    // Increment the numSegments property of the class since new segment being added.
    this.options.numSegments++;
    let segmentPos;

    // Work out where to place the segment, the default is simply as a new segment at the end of the wheel.
    if (!isNil(position)) {
      // Because we need to insert the segment at this position, not overwrite it, we need to move all segments after this
      // location along one in the segments array, before finally adding this new segment at the specified location.
      const startSlice = this.segments.slice(0, position);
      const endSlice = this.segments.slice(position + 1);
      this.segments = [
        ...startSlice,
        newSegment,
        ...endSlice,
      ];
      segmentPos = position;
    } else {
      this.segments.push(newSegment);
      segmentPos = this.segments.length - 1;
    }

    // Since a segment has been added the segment sizes need to be re-computed so call function to do this.
    this.updateSegmentSizes();

    // Return the segment object just created in the wheel (JavaScript will return it by reference), so that
    // further things can be done with it by the calling code if desired.
    return this.segments[segmentPos];
  };

  /**
   * This function deletes the specified segment from the wheel by removing it from the segments array.
   * It then sorts out the other bits such as update of the numSegments.
   *
   * @param {number|null} position
   */
  deleteSegment = (position = null) => {
    // There needs to be at least one segment in order for the wheel to draw, so only allow delete if there
    // is more than one segment currently left in the wheel.

    //++ check that specifying a position that does not exist - say 10 in a 6 segment wheel does not cause issues.
    if (this.segments.length <= 1) return;

    // If the position of the segment to remove has been specified.
    if (!isNil(position)) {
      this.segments = pullAt(this.segments, position);
    } else {
      this.segments.pop();
    }

    // Decrement the number of segments,
    // then call function to update the segment sizes.
    this.options.numSegments--;
    this.updateSegmentSizes();
  };

  /**
   * This function sorts out the segment sizes. Some segments may have set sizes, for the others what is left out of
   * 360 degrees is shared evenly. What this function actually does is set the start and end angle of the arcs.
   */
  updateSegmentSizes = () => {
    if (isEmpty(this.segments)) return;

    // First add up the arc used for the segments where the size has been set.
    let arcUsed = 0;
    let numSet  = 0;

    // Remember, to make it easy to access segments, the position of the segments in the array starts from 1 (not 0).
    this.segments.forEach((segment) => {
      if (segment.options.size) {
        arcUsed += segment.options.size;
        numSet++;
      }
    });

    let arcLeft = 360 - arcUsed;

    // Create variable to hold how much each segment with non-set size will get in terms of degrees.
    let degreesEach = 0;

    if (arcLeft > 0) {
      degreesEach = arcLeft / (this.options.numSegments - numSet);
    }

    // ------------------------------------------
    // Now loop though and set the start and end angle of each segment.
    let currentDegree = 0;

    this.segments.forEach((segment) => {
      const startAngle = currentDegree;

      // If the size is set then add this to the current degree to get the end, else add the degreesEach to it.
      currentDegree += segment.options.size || degreesEach;

      segment.setAngle({
        // Set start angle.
        startAngle,
        endAngle: currentDegree,
      });
    });
  };

  /**
   * This function must be used if the canvasId is changed as we also need to get the context of the new canvas.
   *
   * @param {string|null} id
   */
  setCanvasId = (id = null) => {
    if (id) {
      this.options.canvasId = id;
      this.canvas = document.getElementById(id);

      if (this.canvas) {
        this.ctx = this.canvas.getContext('2d');
      }
    } else {
      this.options.canvasId = null;
      this.ctx = null;
      this.canvas = null;
    }
  };

  /**
   * This function takes the x an the y of a mouse event, such as click or move, and converts the x and the y in to
   * co-ordinates on the canvas as the raw values are the x and the y from the top and left of the user's browser.
   *
   * @param {number} x
   * @param {number} y
   * @returns {{x: number, y: number}}
   */
  windowToCanvas = (x, y) => {
    let bbox = this.canvas.getBoundingClientRect();

    return {
      x: Math.floor(x - bbox.left * (this.canvas.width / bbox.width)),
      y: Math.floor(y - bbox.top *  (this.canvas.height / bbox.height))
    };
  };

  /**
   * This function returns the segment object located at the specified x and y coordinates on the canvas.
   * It is used to allow things to be done with a segment clicked by the user, such as highlight, display or change some values, etc.
   *
   * @param {number} x
   * @param {number} y
   * @returns {Segment}
   */
  getSegmentAt = (x, y) => {
    let foundSegment = null;

    // Call function to return segment number.
    let segmentNumber = this.getSegmentNumberAt(x, y);

    // If found one then set found segment to pointer to the segment object.
    if (!isNil(segmentNumber)) {
      foundSegment = this.segments[segmentNumber];
    }

    return foundSegment;
  };

  /**
   * Returns the number of the segment clicked instead of the segment object.
   * This does not work correctly if the canvas width or height is altered by CSS but does work correctly with the scale factor.
   *
   * @param {number} x
   * @param {number} y
   * @returns {number|null}
   */
  getSegmentNumberAt = (x, y) => {
    // Call function above to convert the raw x and y from the user's browser to canvas coordinates
    // i.e. top and left is top and left of canvas, not top and left of the user's browser.
    let loc = this.windowToCanvas(x, y);

    // ------------------------------------------
    // Now start the process of working out the segment clicked.
    // First we need to figure out the angle of an imaginary line between the centerX and centerY of the wheel and
    // the X and Y of the location (for example a mouse click).
    let topBottom;
    let leftRight;
    let adjacentSideLength;
    let oppositeSideLength;
    let hypotenuseSideLength;

    // Get the centerX and centerY scaled with the scale factor, also the same for outer and inner radius.
    let centerX = (this.options.centerX * this.options.scaleFactor);
    let centerY = (this.options.centerY * this.options.scaleFactor);
    let outerRadius = (this.options.outerRadius * this.options.scaleFactor);
    let innerRadius = (this.options.innerRadius * this.options.scaleFactor);

    // We will use right triangle maths with the TAN function.
    // The start of the triangle is the wheel center, the adjacent side is along the x axis, and the opposite side is along the y axis.

    // We only ever use positive numbers to work out the triangle and the center of the wheel needs to be considered as 0 for the numbers
    // in the maths which is why there is the subtractions below. We also remember what quadrant of the wheel the location is in as we
    // need this information later to add 90, 180, 270 degrees to the angle worked out from the triangle to get the position around a 360 degree wheel.
    if (loc.x > centerX) {
      adjacentSideLength = (loc.x - centerX);
      leftRight = 'R';    // Location is in the right half of the wheel.
    } else {
      adjacentSideLength = (centerX - loc.x);
      leftRight = 'L';    // Location is in the left half of the wheel.
    }

    if (loc.y > centerY) {
      oppositeSideLength = (loc.y - centerY);
      topBottom = 'B';    // Bottom half of wheel.
    } else {
      oppositeSideLength = (centerY - loc.y);
      topBottom = 'T';    // Top Half of wheel.
    }

    // Now divide opposite by adjacent to get tan value.
    let tanVal = oppositeSideLength / adjacentSideLength;

    // Use the tan function and convert results to degrees since that is what we work with.
    let result = (Math.atan(tanVal) * 180/Math.PI);
    let locationAngle = 0;

    // We also need the length of the hypotenuse as later on we need to compare this to the outerRadius of the segment / circle.
    hypotenuseSideLength = Math.sqrt((oppositeSideLength * oppositeSideLength) + (adjacentSideLength * adjacentSideLength));

    // ------------------------------------------
    // Now to make sense around the wheel we need to alter the values based on if the location was in top or bottom half
    // and also right or left half of the wheel, by adding 90, 180, 270 etc. Also for some the initial locationAngle needs to be inverted.
    if ((topBottom === 'T') && (leftRight === 'R')) {
      locationAngle = Math.round(90 - result);
    } else if ((topBottom === 'B') && (leftRight === 'R')) {
      locationAngle = Math.round(result + 90);
    } else if ((topBottom === 'B') && (leftRight === 'L')) {
      locationAngle = Math.round((90 - result) + 180);
    } else if ((topBottom === 'T') && (leftRight === 'L')) {
      locationAngle = Math.round(result + 270);
    }

    // ------------------------------------------
    // And now we have to adjust to make sense when the wheel is rotated from the 0 degrees either
    // positive or negative and it can be many times past 360 degrees.
    if (this.options.rotationAngle !== 0) {
      let rotatedPosition = this.getRotationPosition();

      // So we have this, now we need to alter the locationAngle as a result of this.
      locationAngle -= rotatedPosition;

      // If negative then take the location away from 360.
      if (locationAngle < 0) {
        locationAngle = 360 - Math.abs(locationAngle);
      }
    }

    // ------------------------------------------
    // OK, so after all of that we have the angle of a line between the centerX and centerY of the wheel and
    // the X and Y of the location on the canvas where the mouse was clicked. Now time to work out the segment
    // this corresponds to. We can use the segment start and end angles for this.
    let foundSegmentNumber = null;

    for (let x = 0; x < this.segments.length; x++) {
      // Due to segments sharing start and end angles, if line is clicked will pick earlier segment.
      if ((locationAngle >= this.segments[x]._startAngle) && (locationAngle <= this.segments[x]._endAngle)) {
        // To ensure that a click anywhere on the canvas in the segment direction will not cause a
        // segment to be matched, as well as the angles, we need to ensure the click was within the radius
        // of the segment (or circle if no segment radius).

        // If the hypotenuseSideLength (length of location from the center of the wheel) is with the radius
        // then we can assign the segment to the found segment and break out the loop.

        // Have to take in to account hollow wheels (doughnuts) so check is greater than innerRadius as
        // well as less than or equal to the outerRadius of the wheel.
        if ((hypotenuseSideLength >= innerRadius) && (hypotenuseSideLength <= outerRadius)) {
          foundSegmentNumber = x;
          break;
        }
      }
    }

    // Finally return the number.
    return foundSegmentNumber;
  };

  /**
   * Returns a reference to the segment that is at the location of the pointer on the wheel.
   *
   * @returns {Segment}
   */
  getIndicatedSegment = () => {
    // Call function below to work this out and return the prizeNumber.
    let prizeNumber = this.getIndicatedSegmentNumber();

    // Then simply return the segment in the segments array at that position.
    return this.segments[prizeNumber];
  };

  /**
   * Works out the segment currently pointed to by the pointer of the wheel. Normally called when the spinning has stopped
   * to work out the prize the user has won. Returns the number of the segment in the segments array.
   *
   * @returns {number}
   */
  getIndicatedSegmentNumber = () => {
    let indicatedPrize = 0;
    let rawAngle = this.getRotationPosition();

    // Now we have the angle of the wheel, but we need to take in to account where the pointer is because
    // will not always be at the 12 o'clock 0 degrees location.
    let relativeAngle = Math.floor(this.options.pointerAngle - rawAngle);

    if (relativeAngle < 0) {
      relativeAngle = 360 - Math.abs(relativeAngle);
    }

    // Now we can work out the prize won by seeing what prize segment startAngle and endAngle the relativeAngle is between.
    for (let x = 0; x < this.segments.length; x++) {
      if ((relativeAngle >= this.segments[x]._startAngle) && (relativeAngle <= this.segments[x]._endAngle)) {
        indicatedPrize = x;
        break;
      }
    }

    return indicatedPrize;
  };

  /**
   * Works out what Pin around the wheel is considered the current one which is the one which just passed the pointer.
   * Used to work out if the pin has changed during the animation to trigger a sound.
   * TODO: should this one in Pin class?
   *
   * @returns {number}
   */
  getCurrentPinNumber = () => {
    if (!this.pins) return 0;

    let currentPin = 0;
    let rawAngle = this.getRotationPosition();

    // Now we have the angle of the wheel, but we need to take in to account where the pointer is because
    // will not always be at the 12 o'clock 0 degrees location.
    let relativeAngle = Math.floor(this.options.pointerAngle - rawAngle);

    if (relativeAngle < 0) {
      relativeAngle = 360 - Math.abs(relativeAngle);
    }

    // Work out the angle of the pins as this is simply 360 / the number of pins as they space evenly around.
    let pinSpacing = 360 / this.pins.options.number;
    let totalPinAngle = 0;

    // Now we can work out the pin by seeing what pins relativeAngle is between.
    for (let x = 0; x < this.pins.options.number; x++) {
      if ((relativeAngle >= totalPinAngle) && (relativeAngle <= (totalPinAngle + pinSpacing))) {
        currentPin = x;
        break;
      }

      totalPinAngle += pinSpacing;
    }

    // Now if rotating clockwise we must add 1 to the current pin as we want the pin which has just passed
    // the pointer to be returned as the current pin, not the start of the one we are between.
    if (this.animation.options.direction === DIRECTION.CLOCKWISE) {
      currentPin ++;

      if (currentPin > this.pins.options.number) {
        currentPin = 0;
      }
    }

    return currentPin;
  };

  /**
   * Called when the wheel is to resize. This is normally called from a onresize of the window, also called from onload
   * so the initial size is correct. Here we must re-size the canvas and work out the scaleFactor for the wheel.
   */
  winwheelResize = () => {
    // By default set the margin to 40px, this can be overridden if needed.
    // This is to stop the canvas going right to the right edge of the screen and being overlayed by a scrollbar though
    // if the canvas is center aligned, half the magin will be applied to each side since the margin actually reduces the width of the canvas.
    let margin = 40;

    // If a value has been specified for this then update the margin to it.
    if (!isNil(this._responsiveMargin)) {
      margin = this._responsiveMargin;
    }

    // Get the current width and also optional min and max width properties.
    let width = window.innerWidth - margin;
    let minWidth = this._responsiveMinWidth;
    let minHeight = this._responsiveMinHeight;

    // Adjust the width as it cannot be larger than the original size of the wheel and we don't want
    // the canvas and wheel inside it to be too small so check the min width.
    if (width < minWidth) {
      width = minWidth;
    } else if (width > this._originalCanvasWidth) {
      width = this._originalCanvasWidth;
    }

    // Work out the percent the new width is smaller than the original width.
    let percent = width / this._originalCanvasWidth;

    // Set the canvas width to the width to a percentage of the original width.
    this.canvas.width = this._originalCanvasWidth * percent;

    // Scale the height if we are supposed to but ensure it does not go below the minHeight.
    if (this._responsiveScaleHeight) {
      let height = this._originalCanvasHeight * percent;

      if (height < minHeight) {
        height = minHeight;
      } else if (height > this._originalCanvasHeight) {
        height = this._originalCanvasHeight;
      }

      this.canvas.height = height;
    }

    // OK so now we have the percent, set the scaleFactor of the wheel to this.
    this.options.scaleFactor = percent;

    // Now re-draw the wheel to ensure the changes in size are rendered.
    this.draw();
  };

  /**
   * Called after the image has loaded for each segment. Once all the images are loaded it then calls the draw function
   * on the wheel to render it. Used in constructor and also when a segment image is changed.
   */
  winwheelLoadedImage = () => {
    // Prevent multiple drawings of the wheel which occurs without this check due to timing of function calls.
    if (!this.winwheelAlreadyDrawn) {
      // Set to 0.
      let winwheelImageLoadCount = 0;

      // Loop though all the segments of the wheel and check if image data loaded, if so increment counter.
      for (let i = 0; i < this.segments.length; i++) {
        // Check the image data object is not null and also that the image has completed loading by checking
        // that a property of it such as the height has some sort of true value.
        if ((this.segments[i].options.imgData != null) && (this.segments[i].options.imgData.height)) {
          winwheelImageLoadCount++;
        }
      }

      // If number of images loaded matches the segments then all the images for the wheel are loaded.
      if (winwheelImageLoadCount === this.segments.length) {
        // Call draw function to render the wheel.
        this.winwheelAlreadyDrawn = true;
        this.draw();
      }
    }
  };

  /**
   * This function is called-back when the greensock animation has finished.
   *
   * @param {boolean} canCallback
   */
  winwheelStopAnimation = (canCallback = true) => {
    // When the animation is stopped if canCallback is not false then try to call the callback.
    // false can be passed in to stop the after happening if the animation has been stopped before it ended normally.
    if (canCallback) {
      let { callbackFinished } = this.animation.options;

      if (!isNil(callbackFinished)) {
        // If the callback is a function then call it, otherwise evaluate the property as javascript code.
        if (typeof callbackFinished === 'function') {
          // Pass back the indicated segment as 99% of the time you will want to know this to inform the user of their prize.
          callbackFinished(this.getIndicatedSegment());
        } else {
          eval(callbackFinished);
        }
      }
    }
  };

  /**
   * This function figures out if the callbackSound function needs to be called by working out if the segment or pin
   * has changed since the last animation loop.
   */
  winwheelTriggerSound = () => {
    // If this property does not exist then add it as a property of the winwheel.
    if (!this.hasOwnProperty('_lastSoundTriggerNumber')) {
      this._lastSoundTriggerNumber = 0;
    }

    let { callbackSound, soundTrigger } = this.animation.options;
    let currentTriggerNumber = 0;

    // Now figure out if the sound callback should be called depending on the sound trigger type.
    if (soundTrigger === 'pin') {
      // So for the pin type we need to work out which pin we are between.
      currentTriggerNumber = this.getCurrentPinNumber();
    } else {
      // Check on the change of segment by working out which segment we are in.
      // We can utilise the existing getIndicatedSegmentNumber function.
      currentTriggerNumber = this.getIndicatedSegmentNumber();
    }

    // If the current number is not the same as last time then call the sound callback.
    if (currentTriggerNumber !== this._lastSoundTriggerNumber) {
      // If the property is a function then call it, otherwise eval the property as javascript code.
      if (typeof callbackSound === 'function') {
        callbackSound();
      } else {
        eval(callbackSound);
      }

      // Also update the last sound trigger with the current number.
      this._lastSoundTriggerNumber = currentTriggerNumber;
    }
  };

  /**
   * In order for the wheel to be re-drawn during the spin animation the function greensock calls needs to be outside
   * of the class as for some reason it errors if try to call winwheel.draw() directly.
   */
  winwheelAnimationLoop = () => {
    // Check if the clearTheCanvas is specified for this animation, if not or it is not false then clear the canvas.
    if (this.animation.options.clearTheCanvas) {
      this.clearCanvas();
    }

    const { callbackBefore, callbackAfter, callbackSound } = this.animation.options;

    // If there is a callback function which is supposed to be called before the wheel is drawn then do that.
    if (callbackBefore !== null) {
      // If the property is a function then call it, otherwise eval the property as javascript code.
      if (typeof callbackBefore === 'function') {
        callbackBefore();
      } else {
        eval(callbackBefore);
      }
    }

    // Call code to draw the wheel, pass in false as we never want it to clear the canvas as that would wipe anything drawn in the callbackBefore.
    this.draw(false);

    // If there is a callback function which is supposed to be called after the wheel has been drawn then do that.
    if (callbackAfter !== null) {
      // If the property is a function then call it, otherwise eval the property as javascript code.
      if (typeof callbackAfter === 'function') {
        callbackAfter();
      } else {
        eval(callbackAfter);
      }
    }

    // If there is a sound callback then call a function which figures out if the sound should be triggered
    // and if so then call the function specified by the developer.
    if (callbackSound) this.winwheelTriggerSound();
  };

  /**
   * This function starts the wheel's animation by using the properties of the animation object of of the wheel to begin the a greensock tween.
   */
  startAnimation = () => {
    if (!this.animation) return;

    // Call function to compute the animation properties.
    this.animation.computeAnimation({ pointerAngle: this.options.pointerAngle });

    // Put together the properties of the greensock animation.
    let properties = {
      [this.animation.options.propertyName]: this.animation.options.propertyValue,  // Here we set the property to be animated and its value.
      yoyo: this.animation.options.yoyo,                                            // Set others.
      repeat: this.animation.options.repeat,
      easing: this.animation.options.easing,
      onUpdate: this.winwheelAnimationLoop,                                         // Call function to re-draw the canvas.
      onComplete: this.winwheelStopAnimation,                                       // Call function to perform actions when animation has finished.
    };

    // Do the tween animation passing the properties from the animation object as an array of key => value pairs.
    // Keep reference to the tween object in the wheel as that allows pausing, resuming, and stopping while the animation is still running.
    this.tween = TweenMax.to(this.options, this.animation.options.duration, properties);
  };

  /**
   * Resume the animation by telling tween to continue playing it.
   */
  resumeAnimation = () => {
    if (this.tween) this.tween.play();
  };

  /**
   * Pause animation by telling tween to pause.
   */
  pauseAnimation = () => {
    if (this.tween) this.tween.pause();
  };

  /**
   * Use same function which needs to be outside the class for the callback when it stops because is finished.
   *
   * @param {boolean} canCallback
   */
  stopAnimation = (canCallback) => {
    // @TODO as part of multiwheel, need to work out how to stop the tween for a single wheel but allow others to continue.

    // If the wheel has a tween animation then kill it.
    if (this.tween) {
      this.tween.kill();
    }

    // Call the callback function.
    this.winwheelStopAnimation(canCallback);
  };

  /**
   * Returns the rotation angle of the wheel corrected to 0-360 (i.e. removes all the multiples of 360).
   */
  getRotationPosition = () => {
    let rawAngle = this.options.rotationAngle;  // Get current rotation angle of wheel.

    // If positive work out how many times past 360 this is and then take the floor of this off the rawAngle.
    if (rawAngle >= 0) {
      if (rawAngle > 360) {
        // Get floor of the number of times past 360 degrees.
        let timesPast360 = Math.floor(rawAngle / 360);

        // Take all this extra off to get just the angle 0-360 degrees.
        rawAngle = rawAngle - 360 * timesPast360;
      }
    } else {
      // Is negative, need to take off the extra then convert in to 0-360 degree value
      // so if, for example, was -90 then final value will be (360 - 90) = 270 degrees.
      if (rawAngle < -360) {
        let timesPast360 = Math.ceil(rawAngle / 360);    // Ceil when negative.

        rawAngle = rawAngle - (360 * timesPast360);         // Is minus because dealing with negative.
      }

      rawAngle = 360 + rawAngle;                            // Make in the range 0-360. Is plus because raw is still negative.
    }

    return rawAngle;
  };

  /**
   * Calculates and returns a random stop angle inside the specified segment number. Value will always be 1 degree inside
   * the start and end of the segment to avoid issue with the segment overlap.
   *
   * @param {number|null} segmentNumber
   */
  getRandomForSegment = (segmentNumber = null) => {
    if (!segmentNumber) throw new Error('Segment number not specified');
    if (isNil(this.segments[segmentNumber])) throw new Error(`Segment ${segmentNumber} undefined`);

    return this.segments[segmentNumber].getRandomStopAngle();
  };
}

export default Winwheel;
