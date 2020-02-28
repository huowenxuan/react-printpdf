import DefaultShaper from './DefaultShaper';
import * as UnicodeTrie from 'unicode-trie';
import unicode from '../../unicode-properties'

// let base64String = require('fs').readFileSync(__dirname + '/data.trie')
// console.log(base64String.toString())
let base64String = 'AAEQAAAAAAAAADGgAZUBav7t2CtPA0EUBeDZB00pin9AJZIEgyUEj0QhweDAgQOJxCBRBElQSBwSicLgkOAwnNKZ5GaY2c7uzj4o5yZfZrrbefbuIx2nSq3CGmzAWH/+K+UO7MIe7MMhHMMpnMMFXMIVXIt2t3CnP088iPqjqNN8e4Ij7Rle4LUH82rLm6i/92A+RERERERERERNmfz/89GDeRARERERzbN8ceps2Iwt9H0C9/AJ6yOlDkbTczcot5VSm8Pm1vcFWfb7+BKOLTuOd2UlTX4wGP85Eg953lWPFbnuN7PkjtLmalOWbNenkHOSa7T3KmR9MVTZ2zZkVj1kHa68MueVKH0R4zqQ44WEXLM8VjcWHP0PtKLfPzQnMtGn3W4QYf6qxFxceVI394r2xnV+1rih0fV1Vzf3fO1n3evL5J78ruvZ5ptX2Rwy92Tfb1wlEqut3U+sZ3HXOeJ7/zDrbyuP6+Zz0fqa6Nv3vhY7Yu1xWnGevmsvsUpTT/RYIe8waUH/rvHMWKFzLfN8L+rTfp645mfX7ftlnfDtYxN59w0='
const trie = new UnicodeTrie(base64String);
const FEATURES = ['isol', 'fina', 'fin2', 'fin3', 'medi', 'med2', 'init'];

const ShapingClasses = {
  Non_Joining: 0,
  Left_Joining: 1,
  Right_Joining: 2,
  Dual_Joining: 3,
  Join_Causing: 3,
  ALAPH: 4,
  'DALATH RISH': 5,
  Transparent: 6
};

const ISOL = 'isol';
const FINA = 'fina';
const FIN2 = 'fin2';
const FIN3 = 'fin3';
const MEDI = 'medi';
const MED2 = 'med2';
const INIT = 'init';
const NONE = null;

// Each entry is [prevAction, curAction, nextState]
const STATE_TABLE = [
  //   Non_Joining,        Left_Joining,       Right_Joining,     Dual_Joining,           ALAPH,            DALATH RISH
  // State 0: prev was U,  not willing to join.
  [[NONE, NONE, 0], [NONE, ISOL, 2], [NONE, ISOL, 1], [NONE, ISOL, 2], [NONE, ISOL, 1], [NONE, ISOL, 6]],

  // State 1: prev was R or ISOL/ALAPH,  not willing to join.
  [[NONE, NONE, 0], [NONE, ISOL, 2], [NONE, ISOL, 1], [NONE, ISOL, 2], [NONE, FIN2, 5], [NONE, ISOL, 6]],

  // State 2: prev was D/L in ISOL form,  willing to join.
  [[NONE, NONE, 0], [NONE, ISOL, 2], [INIT, FINA, 1], [INIT, FINA, 3], [INIT, FINA, 4], [INIT, FINA, 6]],

  // State 3: prev was D in FINA form,  willing to join.
  [[NONE, NONE, 0], [NONE, ISOL, 2], [MEDI, FINA, 1], [MEDI, FINA, 3], [MEDI, FINA, 4], [MEDI, FINA, 6]],

  // State 4: prev was FINA ALAPH,  not willing to join.
  [[NONE, NONE, 0], [NONE, ISOL, 2], [MED2, ISOL, 1], [MED2, ISOL, 2], [MED2, FIN2, 5], [MED2, ISOL, 6]],

  // State 5: prev was FIN2/FIN3 ALAPH,  not willing to join.
  [[NONE, NONE, 0], [NONE, ISOL, 2], [ISOL, ISOL, 1], [ISOL, ISOL, 2], [ISOL, FIN2, 5], [ISOL, ISOL, 6]],

  // State 6: prev was DALATH/RISH,  not willing to join.
  [[NONE, NONE, 0], [NONE, ISOL, 2], [NONE, ISOL, 1], [NONE, ISOL, 2], [NONE, FIN3, 5], [NONE, ISOL, 6]]
];

/**
 * This is a shaper for Arabic, and other cursive scripts.
 * It uses data from ArabicShaping.txt in the Unicode database,
 * compiled to a UnicodeTrie by generate-data.coffee.
 *
 * The shaping state machine was ported from Harfbuzz.
 * https://github.com/behdad/harfbuzz/blob/master/src/hb-ot-shape-complex-arabic.cc
 */
export default class ArabicShaper extends DefaultShaper {
  static planFeatures(plan) {
    plan.add(['ccmp', 'locl']);
    for (let i = 0; i < FEATURES.length; i++) {
      let feature = FEATURES[i];
      plan.addStage(feature, false);
    }

    plan.addStage('mset');
  }

  static assignFeatures(plan, glyphs) {
    super.assignFeatures(plan, glyphs);

    let prev = -1;
    let state = 0;
    let actions = [];

    // Apply the state machine to map glyphs to features
    for (let i = 0; i < glyphs.length; i++) {
      let curAction, prevAction;
      var glyph = glyphs[i];
      let type = getShapingClass(glyph.codePoints[0]);
      if (type === ShapingClasses.Transparent) {
        actions[i] = NONE;
        continue;
      }

      [prevAction, curAction, state] = STATE_TABLE[state][type];

      if (prevAction !== NONE && prev !== -1) {
        actions[prev] = prevAction;
      }

      actions[i] = curAction;
      prev = i;
    }

    // Apply the chosen features to their respective glyphs
    for (let index = 0; index < glyphs.length; index++) {
      let feature;
      // 这里
      // let glyph = glyphs[index];
      glyph = glyphs[index];
      // 这里
      // if (feature = actions[index]) {
      //   glyph.features[feature] = true;
      // }
      if (actions[index]) {
        feature = actions[index]
        glyph.features[feature] = true;
      }
    }
  }
}

function getShapingClass(codePoint) {
  let res = trie.get(codePoint);
  if (res) {
    return res - 1;
  }

  let category = unicode.getCategory(codePoint);
  if (category === 'Mn' || category === 'Me' || category === 'Cf') {
    return ShapingClasses.Transparent;
  }

  return ShapingClasses.Non_Joining;
}
