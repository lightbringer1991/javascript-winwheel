import defaults from 'lodash/defaults';
import { degToRad } from './utils';

/**
 * Class for the wheel pins.
 */
class Pin {
  defaultOptions = {
    visible        : true,     // In future there might be some functionality related to the pins even if they are not displayed.
    number         : 36,       // The number of pins. These are evenly distributed around the wheel.
    outerRadius    : 3,        // Radius of the pins which determines their size.
    fillStyle      : 'grey',   // Fill colour of the pins.
    strokeStyle    : 'black',  // Line colour of the pins.
    lineWidth      : 1,        // Line width of the pins.
    margin         : 3,        // The space between outside edge of the wheel and the pins.
    responsive     : false,    // If set to true the diameter of the pin will resize when the wheel is responsive.
  };

  constructor(options = {}) {
    this.options = defaults(options, this.defaultOptions);
  }

  isVisible = () => Boolean(this.options.visible);

  draw = ({ context, centerX, centerY, outerRadius, defaultOptions }) => {
    if (!this.options.number) return;

    // Check if the pin's size is to be responsive too, if so set the pinOuterRadius to a scaled version number.
    let pinOuterRadius = this.options.outerRadius;
    let pinMargin = this.options.margin;

    if (this.options.responsive) {
      pinOuterRadius = pinOuterRadius * defaultOptions.scaleFactor;
      pinMargin = pinMargin * defaultOptions.scaleFactor;
    }

    // Work out the angle to draw each pin a which is simply 360 / the number of pins as they space evenly around.
    //++ There is a slight oddity with the pins in that there is a pin at 0 and also one at 360 and these will be drawn
    //++ directly over the top of each other. Also pins are 0 indexed which could possibly cause some confusion
    //++ with the getCurrentPin function - for now this is just used for audio so probably not a problem.
    let pinSpacing = 360 / this.options.number;

    for (let i = 0; i < this.options.number; i++) {
      context.save();

      // Set the stroke style and line width.
      context.strokeStyle = this.options.strokeStyle;
      context.lineWidth = this.options.lineWidth;
      context.fillStyle = this.options.fillStyle;

      // Move to the center.
      context.translate(centerX, centerY);

      // Rotate to to the pin location which is i * the pinSpacing.
      context.rotate(degToRad(i * pinSpacing + defaultOptions.rotationAngle));

      // Move back out.
      context.translate(-centerX, -centerY);

      // Create a path for the pin circle.
      context.beginPath();
      // x, y, radius, startAngle, endAngle.
      context.arc(centerX,(centerY - outerRadius) + pinOuterRadius + pinMargin, pinOuterRadius, 0, 2 * Math.PI);

      if (this.options.fillStyle) {
        context.fill();
      }

      if (this.options.strokeStyle) {
        context.stroke();
      }

      context.restore();
    }
  };
}

export default Pin;
