var _ = require("underscore");
var teoria = require("teoria");

var CHORDS = [
  "c", "d", "e", "f", "g", "a"
];




// {{{ BUILD LOOKUP OF CHORD NAMES
var MIN_SUFFIX = "m";
var MAJ_SUFFIX = "M";
var DOM_SUFFIX = "dom";
var DIM_SUFFIX = "dim";
var AUG_SUFFIX = "+";

DEBUG=process.env.DEBUG;
function dprint() {
  if (DEBUG) {
    console.log(_.toArray(arguments));
  }
}

function get_flavored_key(chord_ish, flavor) {
  if (typeof(chord_ish) === "string") {
    chord_ish = teoria.chord(chord_ish);
  }

  if (chord_ish.root) {
    if (!flavor) {
      var quality = chord_ish.quality();
      flavor = MAJ_SUFFIX;
      if (quality === "minor") {
        flavor = MIN_SUFFIX;
      }

      if (quality === "diminished") {
        flavor = DIM_SUFFIX;
      }

      if (quality === "dominant") {
        flavor = DOM_SUFFIX;
      }

      if (quality === "augmented") {
        flavor = AUG_SUFFIX;
      }
    }

    return chord_ish.root.name() + chord_ish.root.accidental() + flavor;
  }

  flavor = flavor || "M";
  return chord_ish.name() + chord_ish.accidental() + flavor;



}

var NOTES_TO_CHORD = {};
_.each(CHORDS, function(c) {
  var chord;
  var chord_exts = [ 
    "", 
    "min",
    "maj"
  ];

  _.each(" #b", function(s) {
    cc = c + s;
    _.each(chord_exts, function(ext) {
      try {
        chord = teoria.chord(cc + ext);
        var chord_notes = chord.simple().join(" ");
        NOTES_TO_CHORD[chord_notes] = NOTES_TO_CHORD[chord_notes] || [];
        NOTES_TO_CHORD[chord_notes].push(get_flavored_key(chord));
      } catch(e) {

      }


    });


  });

});

// }}}


// {{{ visiting 

// }}}

// {{{ neo transforms

function get_note_name(note) {
  return note.name() + (note.accidental() || "");
}

var PRL_TRANSFORMS = {
  "I" : {
    min: function(chord) {
      return lookup_chord(chord.simple());
    },
    maj: function(chord) {
      return lookup_chord(chord.simple());
    }
  },
  "P" : {
    min: function(chord) {
      var notes = chord.simple();
      notes[1] = get_note_name(teoria.note(notes[1]).interval("m2"));
      return lookup_chord(notes);
    },
    maj: function(chord) {
      var notes = chord.simple();
      notes[1] = get_note_name(teoria.note(notes[1]).interval("M7"));
      return lookup_chord(notes);
    }
  },
  "R" : {
    min: function(chord) {
      var notes = chord.simple();
      notes[0] = get_note_name(teoria.note(notes[0]).interval("m7"));
      return lookup_chord(notes);
    },
    maj: function(chord) {
      var notes = chord.simple();
      notes[2] = get_note_name(teoria.note(notes[2]).interval("M2"));
      return lookup_chord(notes);
    }

  },
  "L" : {
    min: function(chord) {
      var notes = chord.simple();
      var note = teoria.note(notes[2]).interval('m2');
      notes[2] = get_note_name(note);
      return lookup_chord(notes);
    },
    maj: function(chord) {
      var notes = chord.simple();
      var note = teoria.note(notes[0]).interval('M7');
      notes[0] = get_note_name(note);
      return lookup_chord(notes);
    }

  }


};

// {{{ CHORD LOOKUP 
function lookup_chord(notes) {
  var chord_key = notes.join(" " );
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      if (i == j) { 
        continue;
      }

      
      chord_key = [notes[i], notes[j], notes[3-(j+i)]];
      var chord_keys = [];
      chord_keys.push(_.clone(chord_key));

      _.each(chord_key, function(note, index) {
        _.each(teoria.note(note).enharmonics(), function(n) {
          var prev_val = chord_key[index];
          chord_key[index] = get_note_name(n);
          chord_keys.push(_.clone(chord_key));
          chord_key[index] = prev_val;
        });
      });

      var found;
      _.each(chord_keys, function(chord_key) {
        if (found) {    return; }

        var chord_key_str = chord_key.join(" ");
        if (NOTES_TO_CHORD[chord_key_str]) { 
          found = NOTES_TO_CHORD[chord_key_str]; 
        }
      });

      if (found) {
        return found;
      }

    }
  };
}
// }}}

function transform(type, chord) {
  chord = teoria.chord(chord);

  var quality = chord.quality();

  var ret;
  if (quality == "major") {
    ret = PRL_TRANSFORMS[type.toUpperCase()]["maj"](chord);
  } 
  if (quality == "minor" ){
    ret = PRL_TRANSFORMS[type.toUpperCase()]["min"](chord);
  }


  return ret;
}

// }}}

module.exports = {
  analyze_chords: function(chord_str) {
    chord_str = chord_str || "";
    var chords = chord_str.split(" ");
    _.each(chords, function() {

    });

  },

  find_path_to: function(start, end) {
    start = get_flavored_key(start);
    end = get_flavored_key(end);

    var visited = {};

    var queue = [[get_flavored_key(start), 0, "I"]];

    var i = 0;

    function rebuild_path(end, last_transform) {
      var prev = queue[end][1];
      var chain = [end];
      while (prev) {
        chain.unshift(prev);
        prev = queue[prev][1];
      }

      chain = _.map(chain, function(c) {
        return queue[c][2];
      });

      chain.push(last_transform);

      return chain.join("");
    }

    var paths = [];

    dprint("STARTING AT", queue[0]);
    while (queue.length > i) {
      var next = queue[i][0];
      var prev = queue[i][1];

      visited[next] = true;
      var found;
      _.each("PRL", function(t) {
        var destinations = transform(t, next);
        _.each(destinations, function(d) {
          if (!visited[d]) {
            dprint(next, t, "DEST", d, end);
            queue.push([d, i, t]);
          }

          var d_note = teoria.note(d.replace(/[mM]/g, ""));
          var d_suffix = d[d.length-1];

          if (d === end) {
            dprint("FOUND PATH", t, i);
            paths.push(rebuild_path(i, t));
          }

          _.each(d_note.enharmonics(), function(e) {
            e = get_note_name(e);
            if (e+d_suffix === end) {
              dprint("ENHARMONIC FOUND PATH", t, i);
              paths.push(rebuild_path(i, t));
            }
          });

        });
      });

      i++;
    }

    _.each(queue, function(q, i) {
      dprint(i, q);
    });


    return paths;
  },

};

var secondary_funcs = {
  "RLP" : "N",
  "PLR" : "N",
  "LPR" : "S",
  "RPL" : "S",
  "LPL" : "H",
  "PP" : "",
  "RR" : ""
};

function shorten_path(path) {

  _.each(secondary_funcs, function(replacement, seq) {
    path = path.replace(new RegExp(seq, "g"), replacement);
  });

  return path;

}

var chords = _.clone(process.argv).slice(2);
console.log("input chords:", chords);
console.log("");

for (var i = 0; i < chords.length - 1; i++) {
  var start = chords[i];
  var end = chords[i+1];
  console.log("\ncalculating path from", start, "to", end);

  var paths = module.exports.find_path_to(start, end);

  var shortened_paths = {};
  _.each(paths, function(path) {
    var cur = start;
    shortened_paths[shorten_path(path)] = 1;
    console.log("path:", path, "shortened to:", shorten_path(path));
    // TODO: replay and validate that this path works
  });

  console.log("unique paths:", _.keys(shortened_paths).length, _.keys(shortened_paths));

}


// vim set foldmethod=marker
