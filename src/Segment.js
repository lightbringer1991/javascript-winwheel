import defaults from 'lodash/defaults';
import compact from 'lodash/compact';
import isNil from 'lodash/isNil';
import get from 'lodash/get';
import { degToRad } from './utils';
import { ALIGNMENT, DIRECTION, ORIENTATION } from './constants';

/**
 * Class for segments. When creating a json of options can be passed in.
 */
class Segment {
  defaultOptions = {
    size              : null, // Leave null for automatic. Valid values are degrees 0-360. Use percentToDegrees function if needed to convert.
    text              : '',   // Default is blank.
    fillStyle         : null, // If null for the rest the global default will be used.
    strokeStyle       : null,
    lineWidth         : null,
    textFontFamily    : null,
    textFontSize      : null,
    textFontWeight    : null,
    textOrientation   : null,
    textAlignment     : null,
    textDirection     : null,
    textMargin        : null,
    textFillStyle     : null,
    textStrokeStyle   : null,
    textLineWidth     : null,
    image             : null, // Name/path to the image
    imageDirection    : null, // Direction of the image, can be set globally for the whole wheel.
    imgData           : null  // Image object created here and loaded with image data.
  };

  /**
   *
   * @param {Object} options
   * @param {Winwheel} winwheel
   */
  constructor(options = {}, { handleImageLoad }) {
    this.options = defaults(options, this.defaultOptions);
    this.handleImageLoad = handleImageLoad;

    // There are 2 additional properties which are set by the code, so need to define them here.
    // They are not in the default options because they are not something that should be set by the user,
    // the values are updated every time the updateSegmentSizes() function is called.
    this._startAngle = 0;
    this._endAngle   = 0;
  }

  setAngle = ({ startAngle, endAngle }) => {
    if (!isNil(startAngle)) {
      this._startAngle = startAngle;
    }

    if (!isNil(endAngle)) {
      this._endAngle = endAngle;
    }
  };

  /**
   * Changes an image for a segment by setting a callback to render the wheel once the image has loaded.
   * @param {string} image
   * @param {string} imageDirection one of ['N', 'E', 'S', 'W']
   */
  changeImage = (image, imageDirection) => {
    // Change image name, blank image data.
    this.options.image = image;
    this.options.imgData = null;

    // Set direction.
    if (imageDirection) {
      this.options.imageDirection = imageDirection;
    }

    // Set imgData to a new image object, change set callback and change src (just like in wheel constructor).
    this.options.imgData = new Image();
    this.options.imgData.onload = this.handleImageLoad;
    this.options.imgData.src = this.options.image;
  };

  drawImage = ({ context, centerX, centerY, scaleFactor, rotationAngle, defaultDirection }) => {
    if (!context) return;
    if (!this.options.imgData) this.renderImage();

    // Check image has loaded so a property such as height has a value.
    if (!get(this.options, 'imgData.height')) {
      throw new Error('imgData is not loaded');
    }

    // Work out the correct X and Y to draw the image at which depends on the direction of the image.
    // Images can be created in 4 directions. North, South, East, West.
    // North: Outside at top, inside at bottom. Sits evenly over the 0 degrees angle.
    // South: Outside at bottom, inside at top. Sits evenly over the 180 degrees angle.
    // East: Outside at right, inside at left. Sits evenly over the 90 degrees angle.
    // West: Outside at left, inside at right. Sits evenly over the 270 degrees angle.
    let imageLeft = 0;
    let imageTop = 0;
    let imageAngle = 0;

    // Get scaled width and height of the segment image.
    let scaledWidth = this.options.imgData.width * scaleFactor;
    let scaledHeight = this.options.imgData.height * scaleFactor;
    const imageDirection = this.options.imageDirection || defaultDirection;

    switch (imageDirection) {
      case 'S': {
        // Left set so image sits half/half over the 180 degrees point.
        imageLeft = centerX - scaledWidth / 2;

        // Top so image starts at the centerY.
        imageTop = centerY;

        // Angle to draw the image is its starting angle + half its size.
        // Here we add 180 to the angle to the segment is poistioned correctly.
        imageAngle = this._startAngle + 180 + (this._endAngle - this._startAngle) / 2;

        break;
      }

      case 'E': {
        // Left set so image starts and the center point.
        imageLeft = centerX;

        // Top is so that it sits half/half over the 90 degree point.
        imageTop = centerY - scaledHeight / 2;

        // Again get the angle in the center of the segment and add it to the rotation angle.
        // this time we need to add 270 to that to the segment is rendered the correct place.
        imageAngle = this._startAngle + 270 + (this._endAngle - this._startAngle) / 2;

        break;
      }

      case 'W': {
        // Left is the centerX minus the width of the image.
        imageLeft = centerX - scaledWidth;

        // Top is so that it sits half/half over the 270 degree point.
        imageTop = centerY - scaledHeight / 2;

        // Again get the angle in the center of the segment and add it to the rotation angle.
        // this time we need to add 90 to that to the segment is rendered the correct place.
        imageAngle = this._startAngle + 90 + (this._endAngle - this._startAngle) / 2;

        break;
      }

      default: {
        // North is the default.
        // Left set so image sits half/half over the 0 degrees point.
        imageLeft = centerX - scaledWidth / 2;

        // Top so image is its height out (above) the center point.
        imageTop = centerY - scaledHeight;

        // Angle to draw the image is its starting angle + half its size.
        // this sits it half/half over the center angle of the segment.
        imageAngle = this._startAngle + (this._endAngle - this._startAngle) / 2;
      }
    }

    // --------------------------------------------------
    // Rotate to the position of the segment and then draw the image.
    context.save();
    context.translate(centerX, centerY);

    // So math here is the rotation angle of the wheel plus half way between the start and end angle of the segment.
    context.rotate(degToRad(rotationAngle + imageAngle));
    context.translate(-centerX, -centerY);

    // Draw the image passing the scaled width and height so that it can be responsive.
    context.drawImage(this.options.imgData, imageLeft, imageTop, scaledWidth, scaledHeight);

    context.restore();
  };

  /**
   * When drawing reversed or 'upside down' we need to do some trickery on our part.
   * The canvas text rendering function still draws the text left to right and the correct way up,
   * so we need to overcome this with rotating the opposite side of the wheel the correct way up then pulling the text
   * through the center point to the correct segment it is supposed to be on.
   *
   * @param context
   * @param line
   * @param lineTotal
   * @param centerX
   * @param centerY
   * @param outerRadius
   * @param innerRadius
   * @param fontSize
   * @param margin
   * @param lineOffset
   * @param fillStyle
   * @param strokeStyle
   * @param orientation
   * @param alignment
   * @param defaultOptions
   * @private
   */
  _drawTextReversed = ({ context, line, lineTotal, centerX, centerY, outerRadius, innerRadius, fontSize, margin, lineOffset, fillStyle, strokeStyle, orientation, alignment, defaultOptions }) => {
    switch (orientation) {
      case ORIENTATION.HORIZONTAL: {
        if (alignment === ALIGNMENT.INNER) {
          context.textAlign = 'right';
        } else if (alignment === ALIGNMENT.OUTER) {
          context.textAlign = 'left'
        } else {
          context.textAlign = 'center';
        }

        context.textBaseline = 'middle';

        // Work out the angle to rotate the wheel, this is in the center of the segment but on the opposite side of the wheel which is why do -180.
        const textAngle = degToRad((this._endAngle - ((this._endAngle - this._startAngle) / 2) + defaultOptions.rotationAngle - 90) - 180);

        context.save();
        context.translate(centerX, centerY);
        context.rotate(textAngle);
        context.translate(-centerX, -centerY);

        if (alignment === ALIGNMENT.INNER) {
          // In reversed state the margin is subtracted from the innerX.
          // When inner the inner radius also comes in to play.
          if (fillStyle) {
            context.fillText(line, centerX - innerRadius - margin, centerY + lineOffset);
          }

          if (strokeStyle) {
            context.strokeText(line, centerX - innerRadius - margin, centerY + lineOffset);
          }
        } else if (alignment === ALIGNMENT.OUTER) {
          // In reversed state the position is the center minus the radius + the margin for outer aligned text.
          if (fillStyle) {
            context.fillText(line, centerX - outerRadius + margin, centerY + lineOffset);
          }

          if (strokeStyle) {
            context.strokeText(line, centerX - outerRadius + margin, centerY + lineOffset);
          }
        } else {
          // In reversed state the everything in minused.
          if (fillStyle) {
            context.fillText(line, centerX - innerRadius - ((outerRadius - innerRadius) / 2) - margin, centerY + lineOffset);
          }

          if (strokeStyle) {
            context.strokeText(line, centerX - innerRadius - ((outerRadius - innerRadius) / 2) - margin, centerY + lineOffset);
          }
        }

        context.restore();
        break;
      }

      case ORIENTATION.VERTICAL: {
        // See normal code further down for comments on how it works, this is similar by plus/minus is reversed.
        context.textAlign = 'center';

        // In reversed mode this are reversed.
        if (alignment === ALIGNMENT.INNER) {
          context.textBaseline = 'top';
        } else if (alignment === 'outer') {
          context.textBaseline = 'bottom';
        } else {
          context.textBaseline = 'middle';
        }

        const textAngle = (this._endAngle - ((this._endAngle - this._startAngle) / 2) - 180) + defaultOptions.rotationAngle;
        context.save();
        context.translate(centerX, centerY);
        context.rotate(degToRad(textAngle));
        context.translate(-centerX, -centerY);

        //++ @TODO double-check the default of 0 is correct.
        let yPos = 0;
        if (alignment === ALIGNMENT.OUTER) {
          yPos = centerY + outerRadius - margin;
        } else if (alignment === 'inner') {
          yPos = centerY + innerRadius + margin;
        }

        // I have found that the text looks best when a fraction of the font size is shaved off.
        const yInc = fontSize - fontSize / 9;

        // Loop though and output the characters.
        if (alignment === ALIGNMENT.OUTER) {
          // In reversed mode outer means text in 6 o'clock segment sits at bottom of the wheel and we draw up.
          for (let c = line.length - 1; c >= 0; c--) {
            let character = line.charAt(c);

            if (fillStyle) {
              context.fillText(character, centerX + lineOffset, yPos);
            }

            if (strokeStyle) {
              context.strokeText(character, centerX + lineOffset, yPos);
            }

            yPos -= yInc;
          }
        } else if (alignment === ALIGNMENT.INNER) {
          // In reversed mode inner text is drawn from top of segment at 6 o'clock position to bottom of the wheel.
          for (let c = 0; c < line.length; c++) {
            let character = line.charAt(c);

            if (fillStyle) {
              context.fillText(character, centerX + lineOffset, yPos);
            }

            if (strokeStyle) {
              context.strokeText(character, centerX + lineOffset, yPos);
            }

            yPos += yInc;
          }
        } else if (alignment === ALIGNMENT.CENTER) {
          // Again for reversed this is the opposite of before.
          // If there is more than one character in the text then an adjustment to the position needs to be done.
          // What we are aiming for is to position the center of the text at the center point between the inner and outer radius.
          let centerAdjustment = 0;

          if (line.length > 1) {
            centerAdjustment = yInc * (line.length - 1) / 2;
          }

          let yPos = centerY + innerRadius + (outerRadius - innerRadius) / 2 + centerAdjustment + margin;

          for (let c = (line.length - 1); c >= 0; c--) {
            let character = line.charAt(c);

            if (fillStyle) {
              context.fillText(character, centerX + lineOffset, yPos);
            }

            if (strokeStyle) {
              context.strokeText(character, centerX + lineOffset, yPos);
            }

            yPos -= yInc;
          }
        }

        context.restore();
        break;
      }

      case ORIENTATION.CURVED: {
        // There is no built in canvas function to draw text around an arc,
        // so we need to do this ourselves.
        let radius = 0;

        // Set the alignment of the text - inner, outer, or center by calculating
        // how far out from the center point of the wheel the text is drawn.
        if (alignment === ALIGNMENT.INNER) {
          // When alignment is inner the radius is the innerRadius plus any margin.
          radius = innerRadius + margin;
          context.textBaseline = 'top';
        } else if (alignment === ALIGNMENT.OUTER) {
          // Outer it is the outerRadius minus any margin.
          radius = outerRadius - margin;
          context.textBaseline = 'bottom';

          // We need to adjust the radius in this case to take in to multiline text.
          // In this case the radius needs to be further out, not at the inner radius.
          radius -= fontSize * (lineTotal - 1);
        } else if (alignment === ALIGNMENT.CENTER) {
          // When center we want the text halfway between the inner and outer radius.
          radius = innerRadius + margin + (outerRadius - innerRadius) / 2;
          context.textBaseline = 'middle';
        }

        // Set the angle to increment by when looping though and outputting the characters in the text
        // as we do this by rotating the wheel small amounts adding each character.
        let anglePerChar = 0;
        let drawAngle = 0;

        // If more than one character in the text then...
        if (line.length > 1) {
          // Text is drawn from the left.
          context.textAlign = 'left';

          // Work out how much angle the text rendering loop below needs to rotate by for each character to render them next to each other.
          // I have discovered that 4 * the font size / 10 at 100px radius is the correct spacing for between the characters
          // using a monospace font, non monospace may look a little odd as in there will appear to be extra spaces between chars.
          anglePerChar = 4 * (fontSize / 10);

          // Work out what percentage the radius the text will be drawn at is of 100px.
          let radiusPercent = 100 / radius;

          // Then use this to scale up or down the anglePerChar value.
          // When the radius is less than 100px we need more angle between the letters, when radius is greater (so the text is further
          // away from the center of the wheel) the angle needs to be less otherwise the characters will appear further apart.
          anglePerChar = anglePerChar * radiusPercent;

          // Next we want the text to be drawn in the middle of the segment, without this it would start at the beginning of the segment.
          // To do this we need to work out how much arc the text will take up in total then subtract half of this from the center
          // of the segment so that it sits centred.
          let totalArc = anglePerChar * line.length;

          // Now set initial draw angle to half way between the start and end of the segment.
          drawAngle = this._startAngle + (this._endAngle - this._startAngle) / 2 - totalArc / 2;
        } else {
          // The initial draw angle is the center of the segment when only one character.
          drawAngle = this._startAngle + (this._endAngle - this._startAngle) / 2;

          // To ensure is dead-center the text alignment also needs to be centered.
          context.textAlign = 'center';
        }

        // ----------------------
        // Adjust the initial draw angle as needed to take in to account the rotationAngle of the wheel.
        drawAngle += defaultOptions.rotationAngle;

        // And as with other 'reverse' text direction functions we need to subtract 180 degrees from the angle
        // because when it comes to draw the characters in the loop below we add the radius instead of subtract it.
        drawAngle -= 180;

        // ----------------------
        // Now the drawing itself.
        // In reversed direction mode we loop through the characters in the text backwards in order for them to appear on screen correctly
        for (let c = line.length; c >= 0; c--) {
          context.save();

          let character = line.charAt(c);

          // Rotate the wheel to the draw angle as we need to add the character at this location.
          context.translate(centerX, centerY);
          context.rotate(degToRad(drawAngle));
          context.translate(-centerX, -centerY);

          // Now draw the character directly below the center point of the wheel at the appropriate radius.
          // Note in the reversed mode we add the radius to the this.centerY instead of subtract.
          if (strokeStyle) {
            context.strokeText(character, centerX, centerY + radius + lineOffset);
          }

          if (fillStyle) {
            context.fillText(character, centerX, centerY + radius + lineOffset);
          }

          // Increment the drawAngle by the angle per character so next loop we rotate
          // to the next angle required to draw the character at.
          drawAngle += anglePerChar;

          context.restore();
        }
        break;
      }

      default: {
        throw new Error(`Invalid orientation: ${orientation}`);
      }
    }
  };

  /**
   * Normal direction so do things normally.
   * Check text orientation, of horizontal then reasonably straight forward, if vertical then a bit more work to do.
   *
   * @param context
   * @param line
   * @param lineTotal
   * @param centerX
   * @param centerY
   * @param outerRadius
   * @param innerRadius
   * @param fontSize
   * @param margin
   * @param lineOffset
   * @param fillStyle
   * @param strokeStyle
   * @param orientation
   * @param alignment
   * @param defaultOptions
   * @private
   */
  _drawTextNormal = ({ context, line, lineTotal, centerX, centerY, outerRadius, innerRadius, fontSize, margin, lineOffset, fillStyle, strokeStyle, orientation, alignment, defaultOptions }) => {
    switch (orientation) {
      case ORIENTATION.HORIZONTAL: {
        // Based on the text alignment, set the correct value in the context.
        if (alignment === ALIGNMENT.INNER) {
          context.textAlign = 'left';
        } else if (alignment === ALIGNMENT.OUTER) {
          context.textAlign = 'right';
        } else {
          context.textAlign = 'center';
        }

        // Set this too.
        context.textBaseline = 'middle';

        // Work out the angle around the wheel to draw the text at, which is simply in the middle of the segment the text is for.
        // The rotation angle is added in to correct the annoyance with the canvas arc drawing functions which put the 0 degrees at the 3 oclock
        const textAngle = degToRad(this._endAngle - ((this._endAngle - this._startAngle) / 2) + defaultOptions.rotationAngle - 90);

        // We need to rotate in order to draw the text because it is output horizontally, so to
        // place correctly around the wheel for all but a segment at 3 o'clock we need to rotate.
        context.save();
        context.translate(centerX, centerY);
        context.rotate(textAngle);
        context.translate(-centerX, -centerY);

        // --------------------------
        // Draw the text based on its alignment adding margin if inner or outer.
        if (alignment === ALIGNMENT.INNER) {
          // Inner means that the text is aligned with the inner of the wheel. If looking at a segment in in the 3 o'clock position
          // it would look like the text is left aligned within the segment.

          // Because the segments are smaller towards the inner of the wheel, in order for the text to fit is is a good idea that
          // a margin is added which pushes the text towards the outer a bit.

          // The inner radius also needs to be taken in to account as when inner aligned.

          // If fillstyle is set the draw the text filled in.
          if (fillStyle) {
            context.fillText(line, centerX + innerRadius + margin, centerY + lineOffset);
          }

          // If stroke style is set draw the text outline.
          if (strokeStyle) {
            context.strokeText(line, centerX + innerRadius + margin, centerY + lineOffset);
          }
        } else if (alignment === ALIGNMENT.OUTER) {
          // Outer means the text is aligned with the outside of the wheel, so if looking at a segment in the 3 o'clock position
          // it would appear the text is right aligned. To position we add the radius of the wheel in to the equation
          // and subtract the margin this time, rather than add it.

          // I don't understand why, but in order of the text to render correctly with stroke and fill, the stroke needs to
          // come first when drawing outer, rather than second when doing inner.
          if (fillStyle) {
            context.fillText(line, centerX + outerRadius - margin, centerY + lineOffset);
          }

          // If fillstyle the fill the text.
          if (strokeStyle) {
            context.strokeText(line, centerX + outerRadius - margin, centerY + lineOffset);
          }
        } else {
          // In this case the text is to drawn centred in the segment.
          // Typically no margin is required, however even though centred the text can look closer to the inner of the wheel
          // due to the way the segments narrow in (is optical effect), so if a margin is specified it is placed on the inner
          // side so the text is pushed towards the outer.

          // If stoke style the stroke the text.
          if (fillStyle) {
            context.fillText(line, centerX + innerRadius + ((outerRadius - innerRadius) / 2) + margin, centerY + lineOffset);
          }

          // If fillstyle the fill the text.
          if (strokeStyle) {
            context.strokeText(line, centerX + innerRadius + ((outerRadius - innerRadius) / 2) + margin, centerY + lineOffset);
          }
        }

        // Restore the context so that wheel is returned to original position.
        context.restore();
        break;
      }

      case ORIENTATION.VERTICAL: {
        // If vertical then we need to do this ourselves because as far as I am aware there is no option built in to html canvas
        // which causes the text to draw downwards or upwards one character after another.

        // In this case the textAlign is always center, but the baseline is either top or bottom
        // depending on if inner or outer alignment has been specified.
        context.textAlign = 'center';

        if (alignment === ALIGNMENT.INNER) {
          context.textBaseline = 'bottom';
        } else if (alignment === ALIGNMENT.OUTER) {
          context.textBaseline = 'top';
        } else {
          context.textBaseline = 'middle';
        }

        // The angle to draw the text at is halfway between the end and the starting angle of the segment.
        // Ensure the rotation angle of the wheel is added in, otherwise the test placement won't match
        // the segments they are supposed to be for.
        const textAngle = this._endAngle - ((this._endAngle - this._startAngle) / 2) + defaultOptions.rotationAngle;

        // Rotate so can begin to place the text.
        context.save();
        context.translate(centerX, centerY);
        context.rotate(degToRad(textAngle));
        context.translate(-centerX, -centerY);

        // Work out the position to start drawing in based on the alignment.
        // If outer then when considering a segment at the 12 o'clock position want to start drawing down from the top of the wheel.
        //++ TODO check this as yPos did not seem to have a default before.
        let yPos = 0;

        if (alignment === ALIGNMENT.OUTER) {
          yPos = centerY - outerRadius + margin;
        } else if (alignment === ALIGNMENT.INNER) {
          yPos = centerY - innerRadius - margin;
        }

        // We need to know how much to move the y axis each time.
        // This is not quite simply the font size as that puts a larger gap in between the letters
        // than expected, especially with monospace fonts. I found that shaving a little off makes it look "right".
        const yInc = fontSize - (fontSize / 9);

        // Loop though and output the characters.
        if (alignment === ALIGNMENT.OUTER) {
          // For this alignment we draw down from the top of a segment at the 12 o'clock position to simply
          // loop though the characters in order.
          for (let c = 0; c < line.length; c++) {
            let character = line.charAt(c);

            if (fillStyle) {
              context.fillText(character, centerX + lineOffset, yPos);
            }

            if (strokeStyle) {
              context.strokeText(character, centerX + lineOffset, yPos);
            }

            yPos += yInc;
          }
        } else if (alignment === ALIGNMENT.INNER) {
          // Here we draw from the inner of the wheel up, but in order for the letters in the text text to
          // remain in the correct order when reading, we actually need to loop though the text characters backwards.
          for (let c = line.length - 1; c >= 0; c--) {
            let character = line.charAt(c);

            if (fillStyle) {
              context.fillText(character, centerX + lineOffset, yPos);
            }

            if (strokeStyle) {
              context.strokeText(character, centerX + lineOffset, yPos);
            }

            yPos -= yInc;
          }
        } else if (alignment === ALIGNMENT.CENTER) {
          // This is the most complex of the three as we need to draw the text top down centred between the inner and outer of the wheel.
          // So logically we have to put the middle character of the text in the center then put the others each side of it.
          // In reality that is a really bad way to do it, we can achieve the same if not better positioning using a
          // variation on the method used for the rendering of outer aligned text once we have figured out the height of the text.

          // If there is more than one character in the text then an adjustment to the position needs to be done.
          // What we are aiming for is to position the center of the text at the center point between the inner and outer radius.
          let centerAdjustment = 0;

          if (line.length > 1) {
            centerAdjustment = yInc * (line.length - 1) / 2;
          }

          // Now work out where to start rendering the string. This is half way between the inner and outer of the wheel, with the
          // centerAdjustment included to correctly position texts with more than one character over the center.
          // If there is a margin it is used to push the text away from the center of the wheel.
          let yPos = (centerY - innerRadius - ((outerRadius - innerRadius) / 2)) - centerAdjustment - margin;

          // Now loop and draw just like outer text rendering.
          for (let c = 0; c < line.length; c++) {
            let character = line.charAt(c);

            if (fillStyle) {
              context.fillText(character, centerX + lineOffset, yPos);
            }

            if (strokeStyle) {
              context.strokeText(character, centerX + lineOffset, yPos);
            }

            yPos += yInc;
          }
        }

        context.restore();
        break;
      }

      case ORIENTATION.CURVED: {
        // There is no built in canvas function to draw text around an arc, so
        // we need to do this ourselves.
        let radius = 0;

        // Set the alignment of the text - inner, outer, or center by calculating
        // how far out from the center point of the wheel the text is drawn.
        if (alignment === ALIGNMENT.INNER) {
          // When alignment is inner the radius is the innerRadius plus any margin.
          radius = innerRadius + margin;
          context.textBaseline = 'bottom';

          // We need to adjust the radius in this case to take in to multiline text.
          // In this case the radius needs to be further out, not at the inner radius.
          radius += fontSize * (lineTotal - 1);
        } else if (alignment === ALIGNMENT.OUTER) {
          // Outer it is the outerRadius minus any margin.
          radius = outerRadius - margin;
          context.textBaseline = 'top';
        } else if (alignment === ALIGNMENT.CENTER) {
          // When center we want the text halfway between the inner and outer radius.
          radius = innerRadius + margin + (outerRadius - innerRadius) / 2;
          context.textBaseline = 'middle';
        }

        // Set the angle to increment by when looping though and outputting the characters in the text
        // as we do this by rotating the wheel small amounts adding each character.
        let anglePerChar = 0;
        let drawAngle = 0;

        // If more than one character in the text then...
        if (line.length > 1) {
          // Text is drawn from the left.
          context.textAlign = 'left';

          // Work out how much angle the text rendering loop below needs to rotate by for each character to render them next to each other.
          // I have discovered that 4 * the font size / 10 at 100px radius is the correct spacing for between the characters
          // using a monospace font, non monospace may look a little odd as in there will appear to be extra spaces between chars.
          anglePerChar = 4 * (fontSize / 10);

          // Work out what percentage the radius the text will be drawn at is of 100px.
          const radiusPercent = 100 / radius;

          // Then use this to scale up or down the anglePerChar value.
          // When the radius is less than 100px we need more angle between the letters, when radius is greater (so the text is further
          // away from the center of the wheel) the angle needs to be less otherwise the characters will appear further apart.
          anglePerChar = anglePerChar * radiusPercent;

          // Next we want the text to be drawn in the middle of the segment, without this it would start at the beginning of the segment.
          // To do this we need to work out how much arc the text will take up in total then subtract half of this from the center
          // of the segment so that it sits centred.
          let totalArc = anglePerChar * line.length;

          // Now set initial draw angle to half way between the start and end of the segment.
          drawAngle = this._startAngle + (((this._endAngle - this._startAngle) / 2) - (totalArc / 2));
        } else {
          // The initial draw angle is the center of the segment when only one character.
          drawAngle = this._startAngle + (this._endAngle - this._startAngle) / 2;

          // To ensure is dead-center the text alignment also needs to be centred.
          context.textAlign = 'center';
        }

        // ----------------------
        // Adjust the initial draw angle as needed to take in to account the rotationAngle of the wheel.
        drawAngle += defaultOptions.rotationAngle;

        // ----------------------
        // Now the drawing itself.
        // Loop for each character in the text.
        for (let c = 0; c < (line.length); c++) {
          context.save();

          let character = line.charAt(c);

          // Rotate the wheel to the draw angle as we need to add the character at this location.
          context.translate(centerX, centerY);
          context.rotate(degToRad(drawAngle));
          context.translate(-centerX, -centerY);

          // Now draw the character directly above the center point of the wheel at the appropriate radius.
          if (strokeStyle) {
            context.strokeText(character, centerX, centerY - radius + lineOffset);
          }

          if (fillStyle) {
            context.fillText(character, centerX, centerY - radius + lineOffset);
          }

          // Increment the drawAngle by the angle per character so next loop we rotate
          // to the next angle required to draw the character at.
          drawAngle += anglePerChar;

          context.restore();
        }

        break;
      }

      default: {
        throw new Error(`Invalid orientation ${orientation}`);
      }
    }
  };

  drawText = ({ context, centerX, centerY, outerRadius, innerRadius, defaultOptions }) => {
    // Check is text as no point trying to draw if there is no text to render.
    if (!this.options.text) return;

    // Set values to those for the specific segment or use global default if null.
    const fontFamily = this.options.textFontFamily || defaultOptions.textFontFamily;
    let fontSize = this.options.textFontSize || defaultOptions.textFontSize;
    const fontWeight = this.options.textFontWeight || defaultOptions.textFontWeight;
    const orientation = this.options.textOrientation || defaultOptions.textOrientation;
    const alignment = this.options.textAlignment || defaultOptions.textAlignment;
    const direction = this.options.textDirection || defaultOptions.textDirection;
    let margin = this.options.textMargin || defaultOptions.textMargin;
    const fillStyle = this.options.textFillStyle || defaultOptions.textFillStyle;
    const strokeStyle = this.options.textStrokeStyle || defaultOptions.textStrokeStyle;
    const lineWidth = this.options.textLineWidth || defaultOptions.textLineWidth;

    // Scale the font size and the margin by the scale factor so the text can be responsive.
    fontSize = fontSize * defaultOptions.scaleFactor;
    margin = margin * defaultOptions.scaleFactor;

    // ------------------------------
    // We need to put the font bits together in to one string.
    const fontSettings = compact([
      fontWeight,
      fontSize ? `${fontSize}px` : null, // Fonts on canvas are always a px value.
      fontFamily,
    ]);

    // Now set the canvas context to the decided values.
    context.font = fontSettings.join(' ');
    context.fillStyle = fillStyle;
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;

    // Split the text in to multiple lines on the \n character.
    const lines = this.options.text.split('\n');

    // Figure out the starting offset for the lines as when there are multiple lines need to center the text
    // vertically in the segment (when thinking of normal horozontal text).
    let lineOffset = 0 - (fontSize * (lines.length / 2)) + (fontSize / 2);

    // The offset works great for horizontal and vertical text, also centered curved. But when the text is curved
    // and the alignment is outer then the multiline text should not have some text outside the wheel. Same if inner curved.
    if ((orientation === ORIENTATION.CURVED) && ((alignment === ALIGNMENT.INNER) || (alignment === ALIGNMENT.OUTER))) {
      lineOffset = 0;
    }

    for (let i = 0; i < lines.length; i++) {
      // If direction is reversed then do things differently than if normal (which is the default - see further down)
      if (direction === DIRECTION.REVERSED) {
        this._drawTextReversed({
          context,
          line: lines[i],
          lineTotal: lines.length,
          centerX,
          centerY,
          outerRadius,
          innerRadius,
          fontSize,
          margin,
          lineOffset,
          fillStyle,
          strokeStyle,
          orientation,
          alignment,
          defaultOptions,
        });
      } else {
        this._drawTextNormal({
          context,
          line: lines[i],
          lineTotal: lines.length,
          centerX,
          centerY,
          outerRadius,
          innerRadius,
          fontSize,
          margin,
          lineOffset,
          fillStyle,
          strokeStyle,
          orientation,
          alignment,
          defaultOptions,
        });
      }

      // Increment this ready for the next time.
      lineOffset += fontSize;
    }
  };

  draw = ({ context, centerX, centerY, innerRadius, outerRadius, defaultOptions }) => {
    if (!context) return;

    // Set the variables that defined in the segment, or use the default options.
    const fillStyle = this.options.fillStyle || defaultOptions.fillStyle;
    context.fillStyle = fillStyle;

    const lineWidth = this.options.lineWidth || defaultOptions.lineWidth;
    context.lineWidth = lineWidth;

    const strokeStyle = this.options.strokeStyle || defaultOptions.strokeStyle;
    context.strokeStyle = strokeStyle;

    // Check there is a strokeStyle or fillStyle, if not the segment is invisible so should not try to draw it otherwise a path is began but not ended.
    if (strokeStyle || fillStyle) {
      // Begin a path as the segment consists of an arc and 2 lines.
      context.beginPath();

      // If don't have an inner radius then move to the center of the wheel as we want a line out from the center
      // to the start of the arc for the outside of the wheel when we arc. Canvas will draw the connecting line for us.
      if (!innerRadius) {
        context.moveTo(centerX, centerY);
      } else {
        // Work out the x and y values for the starting point of the segment which is at its starting angle
        // but out from the center point of the wheel by the value of the innerRadius. Some correction for line width is needed.
        let iX = Math.cos(degToRad(this._startAngle + defaultOptions.rotationAngle - 90)) * (innerRadius - lineWidth / 2);
        let iY = Math.sin(degToRad(this._startAngle + defaultOptions.rotationAngle - 90)) * (innerRadius - lineWidth / 2);

        // Now move here relative to the center point of the wheel.
        context.moveTo(centerX + iX, centerY + iY);
      }

      // Draw the outer arc of the segment clockwise in direction -->
      context.arc(
        centerX,
        centerY,
        outerRadius,
        degToRad(this._startAngle + defaultOptions.rotationAngle - 90),
        degToRad(this._endAngle + defaultOptions.rotationAngle - 90),
        false
      );

      if (innerRadius) {
        // Draw another arc, this time anticlockwise <-- at the innerRadius between the end angle and the start angle.
        // Canvas will draw a connecting line from the end of the outer arc to the beginning of the inner arc completing the shape.
        context.arc(
          centerX,
          centerY,
          innerRadius,
          degToRad(this._endAngle + defaultOptions.rotationAngle - 90),
          degToRad(this._startAngle + defaultOptions.rotationAngle - 90),
          true
        );
      } else {
        // If no inner radius then we draw a line back to the center of the wheel.
        context.lineTo(centerX, centerY);
      }

      // Fill and stroke the segment. Only do either if a style was specified, if the style is null then
      // we assume the developer did not want that particular thing.
      // For example no stroke style so no lines to be drawn.
      if (fillStyle) {
        context.fill();
      }

      if (strokeStyle) {
        context.stroke();
      }
    }
  };

  getRandomStopAngle = () => {
    let stopAngle = 0;
    let range = (this._endAngle - this._startAngle) - 2;

    if (range > 0) {
      stopAngle = this._startAngle + 1 + Math.floor(Math.random() * range);
    } else {
      console.log('Segment size is too small to safely get random angle inside it');
    }

    return stopAngle;
  };

  renderImage = () => {
    if (!this.options.image) return;

    const newImage = new Image();
    newImage.onload = this.handleImageLoad;
    newImage.src = this.options.image;
    this.options.imgData = newImage;
  };
}

export default Segment;
