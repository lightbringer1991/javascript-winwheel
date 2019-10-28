import Pin from '../src/Pin';

describe('Pin', () => {
  it('should override default options', () => {
    const pin = new Pin({
      visible: false,
      number: 20,
      outerRadius: 4,
    });

    expect(pin.options).to.eql({
      visible: false,
      number: 20,
      outerRadius: 4,
      fillStyle: 'grey',
      strokeStyle: 'black',
      lineWidth: 1,
      margin: 3,
      responsive: false,
    });
  });

  describe('isVisible()', () => {
    let pin;

    beforeEach(() => {
      pin = new Pin({ visible: true });
    });

    it('should return true if options.visible is true', () => {
      expect(pin.isVisible()).to.equal(true);
    });

    it('should return false if options.visible is false', () => {
      pin.options.visible = false;
      expect(pin.isVisible()).to.equal(false);
    });
  });

  describe('draw', () => {

  });
});
