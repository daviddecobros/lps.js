/*
  This file is part of the lps.js project, released open source under
  the BSD 3-Clause license. For more info, please see https://github.com/mauris/lps.js
 */

const Value = lpsRequire('engine/Value');
const Engine = lpsRequire('engine/Engine');
const Program = lpsRequire('engine/Program');
const ProgramFactory = lpsRequire('parser/ProgramFactory');

const chai = require('chai');
const expect = chai.expect;

describe('types.lps', () => {
  let engine;

  before((done) => {
    let program = new Program();
    engine = new Engine(program);
    engine.load()
      .then(() => {
        done();
      });
  });

  describe('atom_number/2', () => {
    it('should return correct value for list of 2 elements', () => {

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result[0]).to.have.property('theta');

      expect(result[0].theta).to.have.property('A');
      expect(result[0].theta.A).to.be.instanceof(Value);
      expect(result[0].theta.A.evaluate()).to.be.equal(5);
    });
  });
});
