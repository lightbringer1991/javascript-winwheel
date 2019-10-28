import defaults from 'lodash/defaults';
import { degToRad } from './utils';

/**
 * Class that is created as property of the wheel. Draws line from center of the wheel out to edge of canvas to
 * indicate where the code thinks the pointer location is. Helpful to get alignment correct esp when using images.
 */
class PointerGuide {
  defaultOptions = {
    display     : false,
    strokeStyle : 'red',
    lineWidth   : 3,
  };

  constructor(options = {}) {
    this.options = defaults(options, this.defaultOptions);
  }

  isVisible = () => Boolean(this.options.display);

  /**
   * Draws a line from the center of the wheel to the outside at the angle where the code thinks the pointer is.
   */
  draw = (data) => {
    const { context, scaleFactor, pointerAngle } = data;
    if (!context) return;

    // Get scaled center x an y and also the outer radius.
    const centerX = data.centerX * scaleFactor;
    const centerY = data.centerY * scaleFactor;
    const outerRadius = data.outerRadius * scaleFactor;

    context.save();

    // Rotate the canvas to the line goes towards the location of the pointer.
    context.translate(centerX, centerY);
    context.rotate(degToRad(pointerAngle));
    context.translate(-centerX, -centerY);

    // Set line colour and width.
    context.strokeStyle = this.options.strokeStyle;
    context.lineWidth = this.options.lineWidth;

    // Draw from the center of the wheel outwards past the wheel outer radius.
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX, -(outerRadius / 4));

    context.stroke();
    context.restore();
  };
}

export default PointerGuide;
