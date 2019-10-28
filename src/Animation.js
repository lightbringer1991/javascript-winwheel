import defaults from 'lodash/defaults';
import { ANIMATION_TYPE, DIRECTION } from './constants';

class Animation {
  defaultOptions = {
    type              : 'spinOngoing',   // For now there are only supported types are spinOngoing (continuous), spinToStop, spinAndBack, custom.
    direction         : 'clockwise',     // clockwise or anti-clockwise.
    propertyName      : null,            // The name of the winning wheel property to be affected by the animation.
    propertyValue     : null,            // The value the property is to be set to at the end of the animation.
    duration          : 10,              // Duration of the animation.
    yoyo              : false,           // If the animation is to reverse back again i.e. yo-yo.
    repeat            : null,            // The number of times the animation is to repeat, -1 will cause it to repeat forever.
    easing            : null,            // The easing to use for the animation, default is the best for spin to stop. Use Linear.easeNone for no easing.
    stopAngle         : null,            // Used for spinning, the angle at which the wheel is to stop.
    spins             : null,            // Used for spinning, the number of complete 360 degree rotations the wheel is to do.
    clearTheCanvas    : null,            // If set to true the canvas will be cleared before the wheel is re-drawn, false it will not, null the animation will abide by the value of this property for the parent wheel object.
    callbackFinished  : null,            // Function to callback when the animation has finished.
    callbackBefore    : null,            // Function to callback before the wheel is drawn each animation loop.
    callbackAfter     : null,            // Function to callback after the wheel is drawn each animation loop.
    callbackSound     : null,            // Function to callback if a sound should be triggered on change of segment or pin.
    soundTrigger      : 'segment',       // Sound trigger type. Default is segment which triggers when segment changes, can be pin if to trigger when pin passes the pointer.
  };

  constructor(options = {}) {
    this.options = defaults(options, this.defaultOptions);
  }

  /**
   * Called at the beginning of the startAnimation function and computes the values needed to do the animation
   * before it starts. This allows the developer to change the animation properties after the wheel has been created
   * and have the animation use the new values of the animation properties.
   */
  computeAnimation = ({ pointerAngle }) => {
    switch (this.options.type) {
      case ANIMATION_TYPE.SPIN_ONGOING: {
        // When spinning the rotationAngle is the wheel property which is animated.
        this.options.propertyName = 'rotationAngle';

        if (this.options.spins == null) {
          this.options.spins = 5;
        }

        if (this.options.repeat == null) {
          this.options.repeat = -1;           // -1 means it will repeat forever.
        }

        if (this.options.easing == null) {
          this.options.easing = 'Linear.easeNone';
        }

        if (this.options.yoyo == null) {
          this.options.yoyo = false;
        }

        // We need to calculate the propertyValue and this is the spins * 360 degrees.
        this.options.propertyValue = this.options.spins * 360;

        // If the direction is anti-clockwise then make the property value negative.
        if (this.options.direction === DIRECTION.ANTI_CLOCKWISE) {
          this.options.propertyValue = 0 - this.options.propertyValue;
        }

        break;
      }

      case ANIMATION_TYPE.SPIN_TO_STOP: {
        // Spin to stop the rotation angle is affected.
        this.options.propertyName = 'rotationAngle';

        if (this.options.spins == null) {
          this.options.spins = 5;
        }

        if (this.options.repeat == null) {
          this.options.repeat = 0;        // As this is spin to stop we don't normally want it repeated.
        }

        if (this.options.easing == null) {
          this.options.easing = 'Power3.easeOut';     // This easing is fast start and slows over time.
        }

        if (this.options.stopAngle == null) {
          // If the stop angle has not been specified then pick random between 0 and 359.
          this._stopAngle = Math.floor(Math.random() * 359);
        } else {
          // We need to set the internal to 360 minus what the user entered because the wheel spins past 0 without
          // this it would indicate the prize on the opposite side of the wheel. We also need to take in to account
          // the pointerAngle as the stop angle needs to be relative to that.
          this._stopAngle = 360 - this.options.stopAngle + pointerAngle;
        }

        if (this.options.yoyo == null) {
          this.options.yoyo = false;
        }

        // The property value is the spins * 360 then plus or minus the stopAngle depending on if the rotation is clockwise or anti-clockwise.
        this.options.propertyValue = this.options.spins * 360;

        if (this.options.direction === DIRECTION.ANTI_CLOCKWISE) {
          this.options.propertyValue = 0 - this.options.propertyValue;

          // Also if the value is anti-clockwise we need subtract the stopAngle (but to get the wheel to stop in the correct
          // place this is 360 minus the stop angle as the wheel is rotating backwards).
          this.options.propertyValue -= (360 - this._stopAngle);
        } else {
          // Add the stopAngle to the propertyValue as the wheel must rotate around to this place and stop there.
          this.options.propertyValue += this._stopAngle;
        }

        break;
      }

      case ANIMATION_TYPE.SPIN_AND_BACK: {
        // This is basically is a spin for a number of times then the animation reverses and goes back to start.
        // If a repeat is specified then this can be used to make the wheel "rock" left and right.

        // Again this is a spin so the rotationAngle the property which is animated.
        this.options.propertyName = 'rotationAngle';

        if (this.options.spins == null) {
          this.options.spins = 5;
        }

        if (this.options.repeat == null) {
          this.options.repeat = 1;          // This needs to be set to at least 1 in order for the animation to reverse.
        }

        if (this.options.easing == null) {
          this.options.easing = 'Power2.easeInOut';     // This is slow at the start and end and fast in the middle.
        }

        if (this.options.yoyo == null) {
          this.options.yoyo = true;       // This needs to be set to true to have the animation reverse back like a yo-yo.
        }

        if (this.options.stopAngle == null) {
          this._stopAngle = 0;
        } else {
          // We need to set the internal to 360 minus what the user entered
          // because the wheel spins past 0 without this it would indicate the
          // prize on the opposite side of the wheel.
          this._stopAngle = 360 - this.options.stopAngle;
        }

        // The property value is the spins * 360 then plus or minus the stopAngle depending on if the rotation is clockwise or anti-clockwise.
        this.options.propertyValue = this.options.spins * 360;

        if (this.options.direction === DIRECTION.ANTI_CLOCKWISE) {
          this.options.propertyValue = 0 - this.options.propertyValue;

          // Also if the value is anti-clockwise we need subtract the stopAngle (but to get the wheel to stop in the correct
          // place this is 360 minus the stop angle as the wheel is rotating backwards).
          this.options.propertyValue -= (360 - this._stopAngle);
        } else {
          // Add the stopAngle to the propertyValue as the wheel must rotate around to this place and stop there.
          this.options.propertyValue += this._stopAngle;
        }

        break;
      }

      default: {
        // default is custom type
        // Do nothing as all values must be set by the developer in the parameters
        // especially the propertyName and propertyValue.
      }
    }
  };
}

export default Animation;
