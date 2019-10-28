/**
 * Converts degrees to radians which is what is used when specifying the angles on HTML5 canvas arcs.
 *
 * @param {number} deg
 * @returns {number}
 */
export const degToRad = (deg) => deg * 0.0174532925199432957;

/**
 * This function takes the percent 0-100 and returns the number of degrees 0-360 this equates to.
 *
 * @param {number} percentValue
 * @returns {number}
 */
export const percentageToDegrees = (percentValue) => {
  let degrees = 0;

  if ((percentValue > 0) && (percentValue <= 100)) {
    let divider = (percentValue / 100);
    degrees = (360 * divider);
  }

  return degrees;
};
