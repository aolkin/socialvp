new Plugin(
    function CharacterScore() {
	this.scores = {};
	this.useFilter("^\\S+\\+\\+$",this.plus);
	this.useFilter("^\\S+--$",this.minus);
	this.useFilter("^!score \\S+$",this.score,true);
    }, {
	getPerson: function(message) {
	    person = message.slice(0,-2);
	    if (!this.scores[person]) { this.scores[person] = 0; }
	    return person;
	},
	plus: function(message) {
	    person = this.getPerson(message);
	    this.scores[person]++;
	    return message; // + " (Points: "+this.scores[person]+")";
	},
	minus: function(message) {
	    person = this.getPerson(message);
	    this.scores[person]--;
	    return message; // + " (Points: "+this.scores[person]+")";
	},
	score: function(message) {
	    person = message.slice(7);
	    score = this.scores[person];
	    setTimeout(function(){
		svp.receiveChat("ScoreKeeper",score?score:0); },200);
	    return message;
	}
    });
