// QuizRush original question bank.
// Written for this app — original phrasings, no external source or license.
// Shape: { cat, difficulty, text, correct, wrong[3] }
const QUIZRUSH_BANK = [
  // ---------- Logic & Riddles · easy ----------
  { cat: "logic", difficulty: "easy", text: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?", correct: "An echo", wrong: ["A ghost", "A whistle", "A telephone"] },
  { cat: "logic", difficulty: "easy", text: "What has hands but cannot clap?", correct: "A clock", wrong: ["A glove", "A statue", "A puppet"] },
  { cat: "logic", difficulty: "easy", text: "What has to be broken before you can use it?", correct: "An egg", wrong: ["A window", "A stick", "A padlock"] },
  { cat: "logic", difficulty: "easy", text: "The more of me you take, the more you leave behind. What am I?", correct: "Footsteps", wrong: ["Memories", "Money", "Photographs"] },
  { cat: "logic", difficulty: "easy", text: "Some months have 30 days and some have 31. How many months have 28 days?", correct: "All of them", wrong: ["Only February", "One in most years, none in leap years", "Six"] },
  { cat: "logic", difficulty: "easy", text: "Tom's mother has three children. The first is called Penny and the second is called Nickel. What is the third one called?", correct: "Tom", wrong: ["Dime", "Quarter", "Bill"] },
  { cat: "logic", difficulty: "easy", text: "What gets wetter the more it dries?", correct: "A towel", wrong: ["A sponge", "An umbrella", "A raincoat"] },
  { cat: "logic", difficulty: "easy", text: "If you drop a yellow hat into the Red Sea, what does it become?", correct: "Wet", wrong: ["Red", "Orange", "Invisible"] },
  { cat: "logic", difficulty: "easy", text: "What goes up but never comes down?", correct: "Your age", wrong: ["A balloon", "The temperature", "A kite"] },
  { cat: "logic", difficulty: "easy", text: "A farmer has 17 sheep. All but 9 run away. How many sheep are left?", correct: "9", wrong: ["8", "17", "0"] },
  { cat: "logic", difficulty: "easy", text: "Which weighs more: a kilogram of feathers or a kilogram of bricks?", correct: "They weigh the same", wrong: ["The bricks", "The feathers", "It depends on the altitude"] },
  { cat: "logic", difficulty: "easy", text: "What has a neck but no head?", correct: "A bottle", wrong: ["A river", "A ladder", "A mountain"] },
  { cat: "logic", difficulty: "easy", text: "What can you catch but never throw?", correct: "A cold", wrong: ["A boomerang", "A shadow", "A yawn"] },
  { cat: "logic", difficulty: "easy", text: "I'm tall when I'm young and short when I'm old. What am I?", correct: "A candle", wrong: ["A tree", "A pencil", "A shadow"] },
  { cat: "logic", difficulty: "easy", text: "What has one eye but cannot see?", correct: "A needle", wrong: ["A cyclops", "A potato", "A camera"] },

  // ---------- Logic & Riddles · medium ----------
  { cat: "logic", difficulty: "medium", text: "A bat and a ball cost £1.10 together. The bat costs £1 more than the ball. How much is the ball?", correct: "5p", wrong: ["10p", "15p", "1p"] },
  { cat: "logic", difficulty: "medium", text: "What number comes next: 1, 1, 2, 3, 5, 8, …?", correct: "13", wrong: ["11", "12", "16"] },
  { cat: "logic", difficulty: "medium", text: "A doctor gives you three pills and tells you to take one every half hour. How long do the pills last?", correct: "1 hour", wrong: ["1.5 hours", "2 hours", "30 minutes"] },
  { cat: "logic", difficulty: "medium", text: "I am an odd number. Take away a single letter and I become even. What number am I?", correct: "Seven", wrong: ["Nine", "Eleven", "Five"] },
  { cat: "logic", difficulty: "medium", text: "If 5 machines take 5 minutes to make 5 widgets, how long would 100 machines take to make 100 widgets?", correct: "5 minutes", wrong: ["100 minutes", "20 minutes", "1 minute"] },
  { cat: "logic", difficulty: "medium", text: "What breaks every morning yet never falls, and what falls every evening yet never breaks?", correct: "Day and night", wrong: ["Glass and rain", "Waves and leaves", "Dew and darkness"] },
  { cat: "logic", difficulty: "medium", text: "A rooster sits on the exact peak of a barn roof and lays an egg. Which side does the egg roll down?", correct: "Neither — roosters don't lay eggs", wrong: ["The side facing the wind", "The steeper side", "Both sides equally"] },
  { cat: "logic", difficulty: "medium", text: "Forward I am very heavy, but backward I am not. What word am I?", correct: "Ton", wrong: ["Lead", "Iron", "Load"] },
  { cat: "logic", difficulty: "medium", text: "Which five-letter word becomes shorter when you add two letters to it?", correct: "Short", wrong: ["Small", "Brief", "Quick"] },
  { cat: "logic", difficulty: "medium", text: "A patch of lily pads doubles in size every day. It covers the whole lake in 48 days. On which day did it cover half the lake?", correct: "Day 47", wrong: ["Day 24", "Day 46", "Day 36"] },
  { cat: "logic", difficulty: "medium", text: "How many times can you subtract 10 from 100?", correct: "Once — after that you're subtracting from 90", wrong: ["Ten times", "Nine times", "As many times as you like"] },
  { cat: "logic", difficulty: "medium", text: "I have cities but no houses, mountains but no trees, and water but no fish. What am I?", correct: "A map", wrong: ["A photograph", "A snow globe", "A dream"] },
  { cat: "logic", difficulty: "medium", text: "What is always in front of you but can never be seen?", correct: "The future", wrong: ["Your nose", "Air", "Your reflection"] },
  { cat: "logic", difficulty: "medium", text: "A man rode into town on Friday, stayed three nights, and rode out on Friday. How is this possible?", correct: "His horse is named Friday", wrong: ["He crossed the date line", "He stayed a full week", "It was a leap year"] },
  { cat: "logic", difficulty: "medium", text: "Which letter comes next in this sequence: J, F, M, A, M, J, …?", correct: "J", wrong: ["A", "S", "O"] },

  // ---------- Logic & Riddles · hard ----------
  { cat: "logic", difficulty: "hard", text: "In a race, you overtake the runner in second place. What position are you in now?", correct: "Second", wrong: ["First", "Third", "It depends on the field size"] },
  { cat: "logic", difficulty: "hard", text: "A man looks at a portrait and says: \"Brothers and sisters I have none, but this man's father is my father's son.\" Who is in the portrait?", correct: "His son", wrong: ["Himself", "His father", "His nephew"] },
  { cat: "logic", difficulty: "hard", text: "At a party of 100 people, everyone shakes hands exactly once with everyone else. How many handshakes happen?", correct: "4,950", wrong: ["9,900", "10,000", "4,999"] },
  { cat: "logic", difficulty: "hard", text: "What number comes next: 2, 3, 5, 7, 11, 13, …?", correct: "17", wrong: ["15", "16", "19"] },
  { cat: "logic", difficulty: "hard", text: "When David was 6, his sister was half his age. David is now 40. How old is his sister?", correct: "37", wrong: ["20", "34", "43"] },
  { cat: "logic", difficulty: "hard", text: "I am taken from a mine and shut inside a wooden case from which I am never released — yet almost everyone uses me. What am I?", correct: "Pencil lead", wrong: ["A diamond", "Coal", "A fossil"] },
  { cat: "logic", difficulty: "hard", text: "Which English word keeps the same pronunciation even after you remove four of its five letters?", correct: "Queue", wrong: ["Aisle", "Eight", "Knees"] },
  { cat: "logic", difficulty: "hard", text: "A clock takes 5 seconds to strike 6 o'clock, from the first chime to the last. How long does it take to strike 12?", correct: "11 seconds", wrong: ["10 seconds", "12 seconds", "6 seconds"] },
  { cat: "logic", difficulty: "hard", text: "What comes once in a minute, twice in a moment, but never in a thousand years?", correct: "The letter M", wrong: ["A heartbeat", "The number one", "A miracle"] },
  { cat: "logic", difficulty: "hard", text: "Which letter comes next in this sequence: O, T, T, F, F, S, S, …?", correct: "E", wrong: ["N", "T", "O"] },
  { cat: "logic", difficulty: "hard", text: "Two coins add up to 30p. One of them is not a 10p piece. What are the two coins?", correct: "A 20p and a 10p — only one of them isn't a 10p", wrong: ["Two 15p pieces", "A 25p and a 5p", "It's impossible"] },
  { cat: "logic", difficulty: "hard", text: "A snail climbs 3 metres up a 10-metre well each day but slips back 2 metres each night. How many days does it take to get out?", correct: "8 days", wrong: ["10 days", "7 days", "9 days"] },
  { cat: "logic", difficulty: "hard", text: "If you have me, you want to share me. If you share me, you no longer have me. What am I?", correct: "A secret", wrong: ["Money", "Happiness", "A cold"] },
  { cat: "logic", difficulty: "hard", text: "The person who makes it doesn't need it. The person who buys it doesn't use it. The person who uses it never sees it. What is it?", correct: "A coffin", wrong: ["A will", "A gravestone", "An insurance policy"] },
  { cat: "logic", difficulty: "hard", text: "Three doctors all say Robert is their brother, but Robert says he has no brothers. Who is lying?", correct: "Nobody — the doctors are his sisters", wrong: ["Robert", "The doctors", "All of them"] },
  // ---------- Number Games · easy ----------
  { cat: "numbers", difficulty: "easy", text: "What is half of 2, plus 2?", correct: "3", wrong: ["2", "1", "4"] },
  { cat: "numbers", difficulty: "easy", text: "What number comes next: 1, 4, 9, 16, 25, …?", correct: "36", wrong: ["30", "35", "49"] },
  { cat: "numbers", difficulty: "easy", text: "What number comes next: 31, 28, 31, 30, 31, 30, …?", correct: "31", wrong: ["30", "28", "29"] },
  { cat: "numbers", difficulty: "easy", text: "What do you get if you multiply together every number on a phone keypad?", correct: "0", wrong: ["362,880", "45", "1,000,000"] },
  { cat: "numbers", difficulty: "easy", text: "If three cats catch three mice in three minutes, how many cats are needed to catch 100 mice in 100 minutes?", correct: "3", wrong: ["100", "33", "9"] },
  // ---------- Number Games · medium ----------
  { cat: "numbers", difficulty: "medium", text: "A brick weighs 1 kg plus half a brick. How much does the brick weigh?", correct: "2 kg", wrong: ["1.5 kg", "1 kg", "3 kg"] },
  { cat: "numbers", difficulty: "medium", text: "How many times does the digit 9 appear when you write every number from 1 to 100?", correct: "20", wrong: ["10", "11", "19"] },
  { cat: "numbers", difficulty: "medium", text: "Which is bigger: six dozen dozens, or half a dozen dozens?", correct: "Six dozen dozens", wrong: ["Half a dozen dozens", "They're equal", "Neither makes sense"] },
  { cat: "numbers", difficulty: "medium", text: "Which three positive whole numbers give the same answer whether you add them or multiply them?", correct: "1, 2 and 3", wrong: ["2, 3 and 4", "1, 1 and 2", "2, 2 and 2"] },
  { cat: "numbers", difficulty: "medium", text: "What number comes next: 2, 6, 12, 20, 30, …?", correct: "42", wrong: ["40", "36", "44"] },
  // ---------- Number Games · hard ----------
  { cat: "numbers", difficulty: "hard", text: "I'm a two-digit number. My digits add up to 9, and reversing my digits makes me 27 bigger. What am I?", correct: "36", wrong: ["45", "27", "63"] },
  { cat: "numbers", difficulty: "hard", text: "In a shop, a duck costs £9, a spider costs £36 and a bee costs £27. Using the same pricing rule, how much is a cat?", correct: "£18", wrong: ["£12", "£24", "£36"] },
  { cat: "numbers", difficulty: "hard", text: "If 1 = 5, 2 = 25, 3 = 125 and 4 = 625, what is 5?", correct: "1", wrong: ["3,125", "5", "625"] },
  { cat: "numbers", difficulty: "hard", text: "I'm a three-digit number. My tens digit is five more than my ones digit, and my hundreds digit is eight less than my tens digit. What am I?", correct: "194", wrong: ["195", "184", "294"] },
  { cat: "numbers", difficulty: "hard", text: "Which is the only number whose English spelling has all its letters in alphabetical order?", correct: "Forty", wrong: ["Eight", "Sixty", "One"] },
];

// Dingbats bank — original emoji-rebus and typography puzzles written for this
// app. `type: "emoji"` renders huge; `type: "text"` renders as styled lettering
// (\n = line break). `hint` is revealed on request for a points penalty.
const DINGBAT_BANK = [
  { type: "emoji", display: "🌧️ + 🏹", answer: "Rainbow", aliases: ["a rainbow"], hint: "What falls from the sky, plus what fires an arrow." },
  { type: "emoji", display: "🐝 + 🍃", answer: "Believe", aliases: ["belief"], hint: "Say the insect, then the plural of what's on the twig." },
  { type: "emoji", display: "🧈 + 🪰", answer: "Butterfly", aliases: ["a butterfly"], hint: "Spread on toast, plus a buzzing pest." },
  { type: "emoji", display: "⭐ + 🐟", answer: "Starfish", aliases: ["a starfish", "star fish"], hint: "It lives on the seabed." },
  { type: "emoji", display: "🌞 + 🌸", answer: "Sunflower", aliases: ["a sunflower", "sun flower"], hint: "A tall yellow plant that tracks the sky." },
  { type: "emoji", display: "🍯 + 🌙", answer: "Honeymoon", aliases: ["a honeymoon", "honey moon"], hint: "A trip taken just after a wedding." },
  { type: "emoji", display: "🧠 + ⛈️", answer: "Brainstorm", aliases: ["brainstorming", "brain storm"], hint: "What a team does around a whiteboard." },
  { type: "emoji", display: "🐱 + 🚶", answer: "Catwalk", aliases: ["a catwalk", "cat walk"], hint: "Where models strut." },
  { type: "emoji", display: "👁️ + 📱", answer: "iPhone", aliases: ["i phone", "an iphone"], hint: "Say the body part, then the device." },
  { type: "emoji", display: "🧊 + ⛰️", answer: "Iceberg", aliases: ["an iceberg", "ice berg"], hint: "Most of it hides underwater." },
  { type: "emoji", display: "🚪 + 🔔", answer: "Doorbell", aliases: ["a doorbell", "door bell"], hint: "Ding dong." },
  { type: "emoji", display: "🐮 + 👦", answer: "Cowboy", aliases: ["a cowboy", "cow boy"], hint: "Yee-haw." },
  { type: "emoji", display: "👻 + ✍️", answer: "Ghostwriter", aliases: ["a ghostwriter", "ghost writer"], hint: "They write books credited to someone else." },
  { type: "emoji", display: "🕷️ + 👨", answer: "Spider-Man", aliases: ["spiderman", "spider man"], hint: "A Marvel web-slinger." },
  { type: "emoji", display: "🦇 + 👨", answer: "Batman", aliases: ["bat man", "the batman"], hint: "Gotham's caped crusader." },
  { type: "emoji", display: "🌙 + 💡", answer: "Moonlight", aliases: ["moon light"], hint: "What you dance by in old songs." },
  { type: "emoji", display: "🔥 + 🦊", answer: "Firefox", aliases: ["fire fox"], hint: "A web browser." },
  { type: "emoji", display: "🥕 + 🎂", answer: "Carrot cake", aliases: ["a carrot cake", "carrotcake"], hint: "A vegetable in a dessert." },
  { type: "text", display: "STAND\nI", answer: "I understand", aliases: ["understand", "i under stand"], hint: "Where is the I, relative to STAND?" },
  { type: "text", display: "————————\nREAD\n————————", answer: "Read between the lines", aliases: ["reading between the lines"], hint: "Where is READ sitting?" },
  { type: "text", display: "HEAD\n❤️\nHEELS", answer: "Head over heels", aliases: ["head over heels in love"], hint: "How people fall in love." },
  { type: "text", display: "M CE   M CE   M CE", answer: "Three blind mice", aliases: ["3 blind mice"], hint: "Count them — and notice what letter they're all missing." },
  { type: "text", display: "H I J K L M N O", answer: "Water", aliases: ["h2o", "h20"], hint: "Which letters run from... to...? Say it as a formula." },
  { type: "text", display: "BAN ANA", answer: "Banana split", aliases: ["a banana split", "bananasplit"], hint: "A dessert — look at what happened to the word." },
  { type: "text", display: "CYCLE\nCYCLE\nCYCLE", answer: "Tricycle", aliases: ["a tricycle", "tri cycle"], hint: "Count the cycles." },
];

// Flags picture category — every country flag is an emoji, so picture trivia
// with zero image assets. Wrong options come from the same difficulty tier.
// IMPORTANT: these are appended AFTER the first 60 bank entries, keeping the
// pinned daily schedule (DAILY_POOL_SIZE) untouched.
const FLAG_SET = [
  ["🇫🇷","France","easy"],["🇯🇵","Japan","easy"],["🇺🇸","United States","easy"],
  ["🇬🇧","United Kingdom","easy"],["🇮🇹","Italy","easy"],["🇩🇪","Germany","easy"],
  ["🇪🇸","Spain","easy"],["🇧🇷","Brazil","easy"],["🇨🇦","Canada","easy"],
  ["🇦🇺","Australia","easy"],["🇨🇳","China","easy"],["🇮🇪","Ireland","easy"],
  ["🇦🇷","Argentina","medium"],["🇰🇷","South Korea","medium"],["🇸🇪","Sweden","medium"],
  ["🇬🇷","Greece","medium"],["🇹🇷","Turkey","medium"],["🇪🇬","Egypt","medium"],
  ["🇮🇳","India","medium"],["🇲🇽","Mexico","medium"],["🇳🇱","Netherlands","medium"],
  ["🇵🇹","Portugal","medium"],["🇨🇭","Switzerland","medium"],["🇿🇦","South Africa","medium"],
  ["🇰🇿","Kazakhstan","hard"],["🇺🇾","Uruguay","hard"],["🇸🇮","Slovenia","hard"],
  ["🇸🇰","Slovakia","hard"],["🇧🇩","Bangladesh","hard"],["🇵🇪","Peru","hard"],
  ["🇻🇳","Vietnam","hard"],["🇳🇬","Nigeria","hard"],["🇮🇸","Iceland","hard"],
  ["🇭🇷","Croatia","hard"],["🇪🇪","Estonia","hard"],["🇮🇩","Indonesia","hard"],
  ["🇷🇺","Russia","easy"],["🇺🇦","Ukraine","easy"],["🇮🇱","Israel","easy"],
  ["🇳🇿","New Zealand","easy"],["🇸🇦","Saudi Arabia","easy"],["🇯🇲","Jamaica","easy"],
  ["🇨🇺","Cuba","easy"],["🇧🇪","Belgium","easy"],["🇩🇰","Denmark","easy"],
  ["🇦🇪","United Arab Emirates","medium"],
  ["🇵🇱","Poland","medium"],["🇦🇹","Austria","medium"],["🇨🇴","Colombia","medium"],
  ["🇨🇱","Chile","medium"],["🇳🇴","Norway","medium"],["🇫🇮","Finland","medium"],
  ["🇹🇭","Thailand","medium"],["🇵🇭","Philippines","medium"],["🇵🇰","Pakistan","medium"],
  ["🇲🇦","Morocco","medium"],["🇰🇪","Kenya","medium"],["🇬🇭","Ghana","medium"],
  ["🇨🇿","Czechia","medium"],["🇭🇺","Hungary","medium"],["🇷🇴","Romania","medium"],
  ["🇩🇿","Algeria","medium"],["🇹🇳","Tunisia","medium"],
  ["🇲🇨","Monaco","hard"],["🇦🇩","Andorra","hard"],["🇱🇻","Latvia","hard"],
  ["🇱🇹","Lithuania","hard"],["🇧🇬","Bulgaria","hard"],["🇷🇸","Serbia","hard"],
  ["🇦🇱","Albania","hard"],["🇬🇪","Georgia","hard"],["🇦🇲","Armenia","hard"],
  ["🇦🇿","Azerbaijan","hard"],["🇱🇰","Sri Lanka","hard"],["🇳🇵","Nepal","hard"],
  ["🇲🇳","Mongolia","hard"],["🇪🇹","Ethiopia","hard"],["🇹🇿","Tanzania","hard"],
  ["🇻🇪","Venezuela","hard"],["🇵🇾","Paraguay","hard"],
];
FLAG_SET.forEach(([flag, name, diff]) => {
  const pool = FLAG_SET.filter((x) => x[1] !== name && x[2] === diff).map((x) => x[1]);
  const wrong = [];
  while (wrong.length < 3 && pool.length) {
    wrong.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  QUIZRUSH_BANK.push({
    cat: "flags", difficulty: diff,
    text: "Which country flies this flag?", big: flag,
    correct: name, wrong,
  });
});

// Daily pools for the API-backed categories — original questions written for
// this app so the Daily Challenge can be ANY category while staying identical
// for every player. Appended after flags; DAILY_POOLS in app.js pins counts.
const DAILY_EXTRA = [
  // sport
  { cat: "sport", difficulty: "easy", text: "How many players does a football (soccer) team have on the pitch?", correct: "11", wrong: ["10", "12", "9"] },
  { cat: "sport", difficulty: "easy", text: "In which sport would you perform a slam dunk?", correct: "Basketball", wrong: ["Volleyball", "Tennis", "Rugby"] },
  { cat: "sport", difficulty: "easy", text: "Which sport is played at Wimbledon?", correct: "Tennis", wrong: ["Golf", "Cricket", "Polo"] },
  { cat: "sport", difficulty: "easy", text: "How many rings are on the Olympic flag?", correct: "5", wrong: ["4", "6", "7"] },
  { cat: "sport", difficulty: "medium", text: "Which country has won the most FIFA World Cups?", correct: "Brazil", wrong: ["Germany", "Argentina", "Italy"] },
  { cat: "sport", difficulty: "medium", text: "In tennis, what is the score called when both players are on 40?", correct: "Deuce", wrong: ["Advantage", "Love-all", "Break point"] },
  { cat: "sport", difficulty: "medium", text: "How many balls are bowled in a cricket over?", correct: "6", wrong: ["5", "8", "10"] },
  { cat: "sport", difficulty: "medium", text: "In golf, what is one stroke under par called?", correct: "A birdie", wrong: ["An eagle", "A bogey", "An albatross"] },
  { cat: "sport", difficulty: "hard", text: "Olympic gold medals are mostly made of which metal?", correct: "Silver", wrong: ["Gold", "Bronze", "Copper"] },
  { cat: "sport", difficulty: "hard", text: "Which of these is not a fencing weapon?", correct: "Rapier", wrong: ["Foil", "Épée", "Sabre"] },
  // science
  { cat: "science", difficulty: "easy", text: "Which planet is known as the Red Planet?", correct: "Mars", wrong: ["Venus", "Jupiter", "Mercury"] },
  { cat: "science", difficulty: "easy", text: "What gas do plants absorb from the air?", correct: "Carbon dioxide", wrong: ["Oxygen", "Nitrogen", "Hydrogen"] },
  { cat: "science", difficulty: "easy", text: "How many legs does a spider have?", correct: "8", wrong: ["6", "10", "12"] },
  { cat: "science", difficulty: "easy", text: "What is H₂O better known as?", correct: "Water", wrong: ["Salt", "Hydrogen peroxide", "Air"] },
  { cat: "science", difficulty: "medium", text: "What is the largest organ of the human body?", correct: "The skin", wrong: ["The liver", "The lungs", "The brain"] },
  { cat: "science", difficulty: "medium", text: "Which part of the cell contains its DNA?", correct: "The nucleus", wrong: ["The membrane", "The cytoplasm", "The ribosome"] },
  { cat: "science", difficulty: "medium", text: "What is the chemical symbol for gold?", correct: "Au", wrong: ["Go", "Gd", "Ag"] },
  { cat: "science", difficulty: "medium", text: "Which particle in an atom carries a negative charge?", correct: "The electron", wrong: ["The proton", "The neutron", "The photon"] },
  { cat: "science", difficulty: "hard", text: "Roughly how fast does light travel?", correct: "300,000 km per second", wrong: ["30,000 km per second", "3 million km per second", "300 km per second"] },
  { cat: "science", difficulty: "hard", text: "Which blood type is the universal donor?", correct: "O negative", wrong: ["AB positive", "A negative", "O positive"] },
  // history
  { cat: "history", difficulty: "easy", text: "Whose Egyptian tomb was discovered nearly intact in 1922?", correct: "Tutankhamun", wrong: ["Ramesses II", "Cleopatra", "Nefertiti"] },
  { cat: "history", difficulty: "easy", text: "Which famous ship sank on its maiden voyage in 1912?", correct: "The Titanic", wrong: ["The Lusitania", "The Britannic", "The Queen Mary"] },
  { cat: "history", difficulty: "easy", text: "The Great Wall is found in which country?", correct: "China", wrong: ["India", "Mongolia", "Japan"] },
  { cat: "history", difficulty: "medium", text: "In which year did World War II end?", correct: "1945", wrong: ["1944", "1946", "1943"] },
  { cat: "history", difficulty: "medium", text: "Who was the first person to walk on the Moon?", correct: "Neil Armstrong", wrong: ["Buzz Aldrin", "Yuri Gagarin", "John Glenn"] },
  { cat: "history", difficulty: "medium", text: "What language did the ancient Romans speak?", correct: "Latin", wrong: ["Greek", "Italian", "Etruscan"] },
  { cat: "history", difficulty: "medium", text: "Which civilization built Machu Picchu?", correct: "The Inca", wrong: ["The Maya", "The Aztec", "The Olmec"] },
  { cat: "history", difficulty: "hard", text: "The Hundred Years' War was fought mainly between which two countries?", correct: "England and France", wrong: ["Spain and Portugal", "France and Germany", "England and Scotland"] },
  { cat: "history", difficulty: "hard", text: "Which of the Seven Wonders stood at Alexandria?", correct: "The Lighthouse", wrong: ["The Colossus", "The Hanging Gardens", "The Mausoleum"] },
  { cat: "history", difficulty: "hard", text: "In which year did the Berlin Wall fall?", correct: "1989", wrong: ["1991", "1987", "1985"] },
  // geography
  { cat: "geography", difficulty: "easy", text: "What is the largest ocean on Earth?", correct: "The Pacific", wrong: ["The Atlantic", "The Indian", "The Arctic"] },
  { cat: "geography", difficulty: "easy", text: "What is the capital of France?", correct: "Paris", wrong: ["Lyon", "Marseille", "Nice"] },
  { cat: "geography", difficulty: "easy", text: "The Sahara Desert is on which continent?", correct: "Africa", wrong: ["Asia", "Australia", "South America"] },
  { cat: "geography", difficulty: "easy", text: "What is the capital of Japan?", correct: "Tokyo", wrong: ["Osaka", "Kyoto", "Nagoya"] },
  { cat: "geography", difficulty: "medium", text: "Which river is traditionally considered the world's longest?", correct: "The Nile", wrong: ["The Amazon", "The Yangtze", "The Mississippi"] },
  { cat: "geography", difficulty: "medium", text: "What is the smallest country in the world?", correct: "Vatican City", wrong: ["Monaco", "San Marino", "Liechtenstein"] },
  { cat: "geography", difficulty: "medium", text: "Istanbul spans which two continents?", correct: "Europe and Asia", wrong: ["Asia and Africa", "Europe and Africa", "It's only in Europe"] },
  { cat: "geography", difficulty: "hard", text: "Which country observes the most time zones, counting territories?", correct: "France", wrong: ["Russia", "The USA", "China"] },
  { cat: "geography", difficulty: "hard", text: "Which two countries share the longest land border?", correct: "Canada and the USA", wrong: ["Russia and China", "Chile and Argentina", "Kazakhstan and Russia"] },
  { cat: "geography", difficulty: "hard", text: "What is the capital of Australia?", correct: "Canberra", wrong: ["Sydney", "Melbourne", "Perth"] },
  // politics & society
  { cat: "politics", difficulty: "easy", text: "How many stars are on the flag of the United States?", correct: "50", wrong: ["48", "51", "52"] },
  { cat: "politics", difficulty: "easy", text: "What address is the official home of the UK Prime Minister?", correct: "10 Downing Street", wrong: ["Buckingham Palace", "Westminster Abbey", "1 Whitehall"] },
  { cat: "politics", difficulty: "easy", text: "What does \"UN\" stand for?", correct: "United Nations", wrong: ["Union of Nations", "United Networks", "Universal Nations"] },
  { cat: "politics", difficulty: "easy", text: "The White House is in which city?", correct: "Washington, D.C.", wrong: ["New York", "Philadelphia", "Boston"] },
  { cat: "politics", difficulty: "medium", text: "What are the three branches of government usually called?", correct: "Executive, legislative, judicial", wrong: ["Federal, state, local", "Crown, court, commons", "Senate, house, cabinet"] },
  { cat: "politics", difficulty: "medium", text: "Which animal represents the U.S. Democratic Party?", correct: "The donkey", wrong: ["The elephant", "The eagle", "The bear"] },
  { cat: "politics", difficulty: "medium", text: "How many permanent members sit on the UN Security Council?", correct: "5", wrong: ["7", "10", "3"] },
  { cat: "politics", difficulty: "hard", text: "What is the minimum age to be President of the United States?", correct: "35", wrong: ["30", "40", "45"] },
  { cat: "politics", difficulty: "hard", text: "Which country was first to give women the national vote, in 1893?", correct: "New Zealand", wrong: ["The UK", "The USA", "Finland"] },
  { cat: "politics", difficulty: "hard", text: "The European Parliament's official seat is in which city?", correct: "Strasbourg", wrong: ["Brussels", "Geneva", "Luxembourg"] },
  // music & entertainment
  { cat: "entertainment", difficulty: "easy", text: "Which wizard attends Hogwarts School of Witchcraft and Wizardry?", correct: "Harry Potter", wrong: ["Gandalf", "Merlin", "Doctor Strange"] },
  { cat: "entertainment", difficulty: "easy", text: "In The Lion King, what kind of animal is Simba?", correct: "A lion", wrong: ["A tiger", "A leopard", "A cheetah"] },
  { cat: "entertainment", difficulty: "easy", text: "Which film franchise features Darth Vader?", correct: "Star Wars", wrong: ["Star Trek", "Dune", "The Matrix"] },
  { cat: "entertainment", difficulty: "easy", text: "How many keys does a standard piano have?", correct: "88", wrong: ["76", "92", "100"] },
  { cat: "entertainment", difficulty: "medium", text: "Which band recorded \"Hey Jude\"?", correct: "The Beatles", wrong: ["The Rolling Stones", "The Beach Boys", "Queen"] },
  { cat: "entertainment", difficulty: "medium", text: "Who directed both Jaws and E.T.?", correct: "Steven Spielberg", wrong: ["George Lucas", "James Cameron", "Ridley Scott"] },
  { cat: "entertainment", difficulty: "medium", text: "How many strings does a standard violin have?", correct: "4", wrong: ["5", "6", "7"] },
  { cat: "entertainment", difficulty: "medium", text: "Which composer continued writing music after losing his hearing?", correct: "Beethoven", wrong: ["Mozart", "Bach", "Chopin"] },
  { cat: "entertainment", difficulty: "hard", text: "In the acronym EGOT, what does the T stand for?", correct: "Tony", wrong: ["Turner", "TIFF", "Telly"] },
  { cat: "entertainment", difficulty: "hard", text: "Counting both end notes, how many notes span an octave?", correct: "8", wrong: ["7", "10", "12"] },
  // arts & literature
  { cat: "arts", difficulty: "easy", text: "Who painted the Mona Lisa?", correct: "Leonardo da Vinci", wrong: ["Michelangelo", "Raphael", "Botticelli"] },
  { cat: "arts", difficulty: "easy", text: "Who wrote Romeo and Juliet?", correct: "William Shakespeare", wrong: ["Charles Dickens", "Jane Austen", "Oscar Wilde"] },
  { cat: "arts", difficulty: "easy", text: "What do you call a painting of a person?", correct: "A portrait", wrong: ["A landscape", "A still life", "A mural"] },
  { cat: "arts", difficulty: "medium", text: "Which Dutch painter famously lost part of an ear?", correct: "Vincent van Gogh", wrong: ["Rembrandt", "Vermeer", "Mondrian"] },
  { cat: "arts", difficulty: "medium", text: "What are the three primary colors of paint?", correct: "Red, yellow, blue", wrong: ["Red, green, blue", "Red, yellow, green", "Blue, yellow, purple"] },
  { cat: "arts", difficulty: "medium", text: "Who wrote Pride and Prejudice?", correct: "Jane Austen", wrong: ["Charlotte Brontë", "Emily Brontë", "George Eliot"] },
  { cat: "arts", difficulty: "medium", text: "Who sculpted the statue of David?", correct: "Michelangelo", wrong: ["Donatello", "Bernini", "Rodin"] },
  { cat: "arts", difficulty: "hard", text: "Salvador Dalí belonged to which art movement?", correct: "Surrealism", wrong: ["Cubism", "Impressionism", "Expressionism"] },
  { cat: "arts", difficulty: "hard", text: "Who wrote the novel 1984?", correct: "George Orwell", wrong: ["Aldous Huxley", "Ray Bradbury", "H.G. Wells"] },
  { cat: "arts", difficulty: "hard", text: "How many syllables does a traditional haiku have in total?", correct: "17", wrong: ["14", "15", "21"] },
  // celebrity culture
  { cat: "celebs", difficulty: "easy", text: "Which boxer said he could \"float like a butterfly, sting like a bee\"?", correct: "Muhammad Ali", wrong: ["Mike Tyson", "Joe Frazier", "Sugar Ray Leonard"] },
  { cat: "celebs", difficulty: "easy", text: "What was the name of Elvis Presley's Memphis mansion?", correct: "Graceland", wrong: ["Neverland", "Dollywood", "Monticello"] },
  { cat: "celebs", difficulty: "easy", text: "Who is known as the King of Pop?", correct: "Michael Jackson", wrong: ["Prince", "Elvis Presley", "Freddie Mercury"] },
  { cat: "celebs", difficulty: "medium", text: "Which actress starred in Breakfast at Tiffany's?", correct: "Audrey Hepburn", wrong: ["Marilyn Monroe", "Grace Kelly", "Elizabeth Taylor"] },
  { cat: "celebs", difficulty: "medium", text: "Charlie Chaplin rose to fame in which era of film?", correct: "The silent era", wrong: ["The talkies", "The Technicolor era", "The New Wave"] },
  { cat: "celebs", difficulty: "medium", text: "Which Beatle played the drums?", correct: "Ringo Starr", wrong: ["John Lennon", "Paul McCartney", "George Harrison"] },
  { cat: "celebs", difficulty: "medium", text: "Harry Houdini was world-famous as what?", correct: "An escape artist", wrong: ["A ventriloquist", "A tightrope walker", "A lion tamer"] },
  { cat: "celebs", difficulty: "hard", text: "What was Marilyn Monroe's real first name?", correct: "Norma", wrong: ["Mary", "Dorothy", "Betty"] },
  { cat: "celebs", difficulty: "hard", text: "Grace Kelly became princess of which country?", correct: "Monaco", wrong: ["Luxembourg", "Belgium", "Liechtenstein"] },
  { cat: "celebs", difficulty: "hard", text: "What was Frank Sinatra's famous nickname?", correct: "Ol' Blue Eyes", wrong: ["The Duke", "The King", "Mr. Smooth"] },
  // food & drink
  { cat: "food", difficulty: "easy", text: "Sushi originally comes from which country?", correct: "Japan", wrong: ["China", "Thailand", "Korea"] },
  { cat: "food", difficulty: "easy", text: "Which fruit is dried to make raisins?", correct: "Grapes", wrong: ["Plums", "Apricots", "Figs"] },
  { cat: "food", difficulty: "easy", text: "Pizza originated in which country?", correct: "Italy", wrong: ["Greece", "France", "Spain"] },
  { cat: "food", difficulty: "easy", text: "What is the main ingredient in guacamole?", correct: "Avocado", wrong: ["Cucumber", "Green pepper", "Peas"] },
  { cat: "food", difficulty: "medium", text: "Which spice is the most expensive in the world by weight?", correct: "Saffron", wrong: ["Vanilla", "Cardamom", "Truffle salt"] },
  { cat: "food", difficulty: "medium", text: "Paella comes from which country?", correct: "Spain", wrong: ["Portugal", "Mexico", "Italy"] },
  { cat: "food", difficulty: "medium", text: "Besides tahini, what is the main ingredient of hummus?", correct: "Chickpeas", wrong: ["Lentils", "White beans", "Peanuts"] },
  { cat: "food", difficulty: "medium", text: "What grain is risotto made from?", correct: "Rice", wrong: ["Barley", "Couscous", "Quinoa"] },
  { cat: "food", difficulty: "hard", text: "Which cheese is traditional in tiramisu?", correct: "Mascarpone", wrong: ["Ricotta", "Cream cheese", "Mozzarella"] },
  { cat: "food", difficulty: "hard", text: "Croissants are made from which kind of dough?", correct: "Laminated (layered) dough", wrong: ["Shortcrust", "Choux", "Filo"] },
  // general knowledge
  { cat: "general", difficulty: "easy", text: "How many days are in a leap year?", correct: "366", wrong: ["365", "364", "367"] },
  { cat: "general", difficulty: "easy", text: "Traditionally, how many colors are in a rainbow?", correct: "7", wrong: ["6", "8", "5"] },
  { cat: "general", difficulty: "easy", text: "What is the largest mammal on Earth?", correct: "The blue whale", wrong: ["The elephant", "The giraffe", "The orca"] },
  { cat: "general", difficulty: "easy", text: "How many sides does a hexagon have?", correct: "6", wrong: ["5", "7", "8"] },
  { cat: "general", difficulty: "medium", text: "What currency is used in Japan?", correct: "The yen", wrong: ["The won", "The yuan", "The ringgit"] },
  { cat: "general", difficulty: "medium", text: "Which language has the most native speakers?", correct: "Mandarin Chinese", wrong: ["English", "Spanish", "Hindi"] },
  { cat: "general", difficulty: "medium", text: "What is the tallest animal in the world?", correct: "The giraffe", wrong: ["The elephant", "The ostrich", "The moose"] },
  { cat: "general", difficulty: "hard", text: "Which letter appears in no U.S. state name?", correct: "Q", wrong: ["Z", "X", "J"] },
  { cat: "general", difficulty: "hard", text: "How many dots are on a standard die in total?", correct: "21", wrong: ["24", "18", "20"] },
  { cat: "general", difficulty: "hard", text: "What is a group of crows called?", correct: "A murder", wrong: ["A parliament", "A gaggle", "A conspiracy"] },
];
DAILY_EXTRA.forEach((q) => QUIZRUSH_BANK.push(q));

// "Who Am I?" bank — 4 clues per character, ordered obscure → obvious.
// Original clue phrasings written for this app. `aliases` are the accepted
// short forms; fuzzy matching adds misspelling tolerance on top.
const WHOAMI_BANK = [
  { answer: "Albert Einstein", aliases: ["einstein"], facts: [
    "I was born in Ulm, Germany, in 1879, and I was slow to speak as a child.",
    "Before I became famous, I examined inventions as a clerk in a Swiss patent office.",
    "I won the 1921 Nobel Prize in Physics — though not for my most famous theory.",
    "My name has become a synonym for genius, and E = mc² is my most famous equation." ] },
  { answer: "Cleopatra", aliases: ["cleopatra vii"], facts: [
    "Though I ruled an African kingdom, my family line was Macedonian Greek.",
    "I spoke many languages and was the first of my dynasty to learn the local tongue.",
    "Two of the most powerful Romans of my age were fathers to my children.",
    "I was the last pharaoh of Egypt, and legend says my life ended with a snake bite." ] },
  { answer: "Leonardo da Vinci", aliases: ["da vinci", "leonardo"], facts: [
    "I was born out of wedlock near a Tuscan village whose name I carry.",
    "My notebooks are written in mirror-image script and sketch flying machines.",
    "I painted 'The Last Supper' on a monastery wall in Milan.",
    "My portrait of a woman with a mysterious smile hangs in the Louvre." ] },
  { answer: "Serena Williams", aliases: ["serena"], facts: [
    "I grew up practicing on public courts in Compton, California.",
    "My older sister and I have faced each other in nine Grand Slam finals.",
    "I won an Australian Open title while expecting my first child.",
    "My 23 Grand Slam singles titles are the most of any player in the Open era." ] },
  { answer: "Nelson Mandela", aliases: ["mandela"], facts: [
    "As a boy in the Eastern Cape I was given the name Rolihlahla.",
    "I trained as a lawyer and opened my country's first Black law firm.",
    "I spent 18 of my 27 prison years on Robben Island.",
    "I became South Africa's first democratically elected president in 1994." ] },
  { answer: "William Shakespeare", aliases: ["shakespeare"], facts: [
    "I was born and buried in the same market town on the River Avon.",
    "I left my wife our 'second-best bed' in my will.",
    "My acting company performed at a London theatre called the Globe.",
    "I wrote Hamlet, Macbeth, and Romeo and Juliet." ] },
  { answer: "Frida Kahlo", aliases: ["kahlo", "frida"], facts: [
    "A bus accident at 18 left me in pain for life and turned me to painting.",
    "I was married twice — to the same famous muralist.",
    "My Mexico City home, the Blue House, is now a museum.",
    "My self-portraits with a unibrow and flower crowns are icons of Mexican art." ] },
  { answer: "Muhammad Ali", aliases: ["ali", "cassius clay"], facts: [
    "I won Olympic gold in Rome under the name my parents gave me.",
    "I refused the Vietnam draft and was stripped of my title for it.",
    "I fought in the 'Rumble in the Jungle' and the 'Thrilla in Manila'.",
    "I called myself 'The Greatest' and floated like a butterfly." ] },
  { answer: "Marie Curie", aliases: ["curie"], facts: [
    "I was born in Warsaw but did my life's work in Paris.",
    "My notebooks are still radioactive and kept in lead-lined boxes.",
    "I named my first element after my homeland.",
    "I am the only person to win Nobel Prizes in two different sciences." ] },
  { answer: "Elvis Presley", aliases: ["elvis", "presley"], facts: [
    "I was a twin, but my brother did not survive our birth.",
    "I bought a Memphis mansion called Graceland at age 22.",
    "My swiveling hips were once considered too scandalous for television.",
    "I am called the King of Rock and Roll." ] },
  { answer: "Napoleon Bonaparte", aliases: ["napoleon", "bonaparte"], facts: [
    "I was born on a Mediterranean island a year after France bought it from Genoa.",
    "I sold a vast territory to the young United States to fund my wars.",
    "I crowned myself emperor rather than let the Pope do it.",
    "I met my final defeat at Waterloo and died in exile on Saint Helena." ] },
  { answer: "Usain Bolt", aliases: ["bolt"], facts: [
    "I grew up in a small Jamaican parish and first excelled at cricket.",
    "I ate chicken nuggets before racing at the Beijing Olympics.",
    "I struck a 'lightning' pose after every victory.",
    "My 9.58-second 100 metres is still the world record." ] },
  { answer: "Amelia Earhart", aliases: ["earhart"], facts: [
    "I worked as a nurse's aide and social worker before taking to the skies.",
    "I founded an organization for female pilots called the Ninety-Nines.",
    "I was the first woman to fly solo across the Atlantic.",
    "I vanished over the Pacific in 1937 while trying to circle the globe." ] },
  { answer: "Ludwig van Beethoven", aliases: ["beethoven"], facts: [
    "My father passed me off as younger than I was to market me as a prodigy.",
    "I dedicated a symphony to Napoleon, then furiously scratched out his name.",
    "I continued composing masterpieces after losing my hearing entirely.",
    "My Fifth Symphony opens with fate knocking: da-da-da-dum." ] },
  { answer: "Mahatma Gandhi", aliases: ["gandhi"], facts: [
    "I trained as a barrister in London and practiced law in South Africa.",
    "Being thrown off a train for my skin color changed the course of my life.",
    "I led a 240-mile march to the sea to protest a tax on salt.",
    "My nonviolent resistance helped win India's independence." ] },
  { answer: "Michael Jackson", aliases: ["jackson", "mj"], facts: [
    "I was the eighth of ten children in a musical family from Gary, Indiana.",
    "I debuted a gliding dance move during a performance of 'Billie Jean'.",
    "My 1982 album is the best-selling record of all time.",
    "I wore a single sequined glove and was crowned the King of Pop." ] },
];
