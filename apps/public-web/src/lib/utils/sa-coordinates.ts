export const SA_TOWN_COORDS: Record<string, { lat: number; lng: number }> = {
  // Major cities
  'Johannesburg': { lat: -26.20, lng: 28.04 },
  'Pretoria': { lat: -25.75, lng: 28.19 },
  'Cape Town': { lat: -33.93, lng: 18.42 },
  'Durban': { lat: -29.86, lng: 31.02 },
  'Port Elizabeth': { lat: -33.96, lng: 25.60 },
  'Gqeberha': { lat: -33.96, lng: 25.60 },
  'Bloemfontein': { lat: -29.12, lng: 26.21 },
  'Polokwane': { lat: -23.91, lng: 29.45 },
  'Nelspruit': { lat: -25.47, lng: 30.97 },
  'Mbombela': { lat: -25.47, lng: 30.97 },
  'Kimberley': { lat: -28.74, lng: 24.77 },
  'Mahikeng': { lat: -25.87, lng: 25.64 },
  'Mafikeng': { lat: -25.87, lng: 25.64 },
  'Pietermaritzburg': { lat: -29.60, lng: 30.38 },
  'Rustenburg': { lat: -25.67, lng: 27.24 },

  // Gauteng
  'Centurion': { lat: -25.86, lng: 28.19 },
  'Soweto': { lat: -26.27, lng: 27.86 },
  'Benoni': { lat: -26.19, lng: 28.32 },
  'Midrand': { lat: -25.99, lng: 28.13 },
  'Alexandra': { lat: -26.10, lng: 28.10 },
  'Tembisa': { lat: -25.99, lng: 28.23 },
  'Katlehong': { lat: -26.35, lng: 28.19 },
  'Thokoza': { lat: -26.36, lng: 28.15 },
  'Sebokeng': { lat: -26.57, lng: 27.83 },
  'Evaton': { lat: -26.53, lng: 27.85 },
  'Heidelberg': { lat: -26.50, lng: 28.36 },
  'Nigel': { lat: -26.43, lng: 28.47 },
  'Delmas': { lat: -26.15, lng: 28.68 },
  'Springs': { lat: -26.25, lng: 28.44 },
  'Boksburg': { lat: -26.22, lng: 28.26 },
  'Germiston': { lat: -26.22, lng: 28.17 },
  'Kempton Park': { lat: -26.10, lng: 28.23 },
  'Randburg': { lat: -26.09, lng: 28.00 },
  'Sandton': { lat: -26.11, lng: 28.06 },
  'Roodepoort': { lat: -26.16, lng: 27.87 },
  'Krugersdorp': { lat: -26.08, lng: 27.77 },
  'Mogale City': { lat: -26.08, lng: 27.77 },
  'Randfontein': { lat: -26.18, lng: 27.70 },
  'Carletonville': { lat: -26.36, lng: 27.40 },
  'Brakpan': { lat: -26.24, lng: 28.37 },
  'Alberton': { lat: -26.27, lng: 28.12 },
  'Edenvale': { lat: -26.14, lng: 28.15 },
  'Bedfordview': { lat: -26.18, lng: 28.13 },
  'Fourways': { lat: -26.02, lng: 28.01 },
  'Diepsloot': { lat: -25.93, lng: 28.01 },
  'Ivory Park': { lat: -25.97, lng: 28.20 },
  'Orange Farm': { lat: -26.49, lng: 27.87 },
  'Lenasia': { lat: -26.33, lng: 27.83 },
  'Bronkhorstspruit': { lat: -25.81, lng: 28.74 },
  'Bapsfontein': { lat: -26.03, lng: 28.52 },
  'Babsfontein': { lat: -26.03, lng: 28.52 },
  'Magaliesburg': { lat: -25.99, lng: 27.55 },
  'Henley on Klip': { lat: -26.56, lng: 28.05 },
  'Henley-on-Klip': { lat: -26.56, lng: 28.05 },
  'Sasolburg': { lat: -26.81, lng: 27.83 },
  'Vereeniging': { lat: -26.67, lng: 27.93 },
  'Vanderbijlpark': { lat: -26.71, lng: 27.84 },

  // Limpopo
  'Musina': { lat: -22.34, lng: 30.04 },
  'Messina': { lat: -22.34, lng: 30.04 },
  'Lephalale': { lat: -23.69, lng: 27.70 },
  'Ellisras': { lat: -23.69, lng: 27.70 },
  'Mokopane': { lat: -24.19, lng: 29.01 },
  'Potgietersrus': { lat: -24.19, lng: 29.01 },
  'Vaalwater': { lat: -24.30, lng: 28.10 },
  'Haenertsburg': { lat: -23.94, lng: 29.94 },
  'Tzaneen': { lat: -23.83, lng: 30.16 },
  'Modjadjiskloof': { lat: -23.69, lng: 30.14 },
  'Duiwelskloof': { lat: -23.69, lng: 30.14 },
  'Louis Trichardt': { lat: -23.05, lng: 29.90 },
  'Makhado': { lat: -23.05, lng: 29.90 },
  'Thohoyandou': { lat: -22.95, lng: 30.48 },
  'Giyani': { lat: -23.31, lng: 30.72 },
  'Phalaborwa': { lat: -23.94, lng: 31.14 },
  'Hoedspruit': { lat: -24.35, lng: 30.97 },
  'Thabazimbi': { lat: -24.59, lng: 27.41 },
  'Bela-Bela': { lat: -24.88, lng: 28.29 },
  'Warmbaths': { lat: -24.88, lng: 28.29 },
  'Modimolle': { lat: -24.69, lng: 28.41 },
  'Nylstroom': { lat: -24.69, lng: 28.41 },
  'Soshanguve': { lat: -25.44, lng: 28.10 },
  'Mamelodi': { lat: -25.72, lng: 28.39 },
  'Atteridgeville': { lat: -25.77, lng: 28.08 },
  'Hammanskraal': { lat: -25.41, lng: 28.28 },
  'Siyabuswa': { lat: -25.12, lng: 29.05 },
  'Naboomspruit': { lat: -24.57, lng: 28.74 },
  'Mookgophong': { lat: -24.57, lng: 28.74 },
  'Lykso': { lat: -25.55, lng: 28.30 },
  'Settlers': { lat: -25.08, lng: 30.29 },
  'Dendron': { lat: -23.37, lng: 29.33 },
  'Lebowakgomo': { lat: -24.20, lng: 29.50 },
  'Marble Hall': { lat: -24.97, lng: 29.28 },
  'Groblersdal': { lat: -25.17, lng: 29.40 },
  'Roedtan': { lat: -24.07, lng: 29.10 },
  'Tom Burke': { lat: -23.97, lng: 27.92 },
  'Alldays': { lat: -22.68, lng: 29.10 },
  'Bandelierkop': { lat: -23.39, lng: 29.92 },

  // Mpumalanga
  'Ermelo': { lat: -26.53, lng: 29.99 },
  'Secunda': { lat: -26.51, lng: 29.17 },
  'Witbank': { lat: -25.88, lng: 29.23 },
  'Emalahleni': { lat: -25.88, lng: 29.23 },
  'Middelburg': { lat: -25.77, lng: 29.47 },
  'Burgersfort': { lat: -24.67, lng: 30.35 },
  'Lydenburg': { lat: -25.10, lng: 30.45 },
  'Mashishing': { lat: -25.10, lng: 30.45 },
  'Barberton': { lat: -25.79, lng: 31.05 },
  'Komatipoort': { lat: -25.44, lng: 31.94 },
  'White River': { lat: -25.33, lng: 31.01 },
  'Standerton': { lat: -26.95, lng: 29.24 },
  'Volksrust': { lat: -27.37, lng: 29.89 },
  'Bethal': { lat: -26.46, lng: 29.47 },
  'Ogies': { lat: -26.05, lng: 29.05 },
  'Dullstroom': { lat: -25.41, lng: 30.11 },
  'Tweefontein': { lat: -25.95, lng: 29.20 },
  'Mooinooi': { lat: -25.63, lng: 27.47 },
  'Piet Retief': { lat: -27.01, lng: 30.81 },
  'Mkhondo': { lat: -27.01, lng: 30.81 },
  'Balfour': { lat: -26.65, lng: 28.60 },
  'Greylingstad': { lat: -26.75, lng: 28.75 },
  'Hendrina': { lat: -26.16, lng: 29.71 },
  'Machadodorp': { lat: -25.66, lng: 30.25 },
  'Waterval Boven': { lat: -25.63, lng: 30.35 },
  'Sabie': { lat: -25.10, lng: 30.78 },
  'Graskop': { lat: -24.93, lng: 30.84 },
  'Hazyview': { lat: -25.05, lng: 31.13 },
  'Malelane': { lat: -25.49, lng: 31.52 },
  'Carolina': { lat: -26.07, lng: 30.12 },
  'Amsterdam': { lat: -26.70, lng: 30.65 },

  // North West
  'Potchefstroom': { lat: -26.72, lng: 27.10 },
  'Tlokwe': { lat: -26.72, lng: 27.10 },
  'Klerksdorp': { lat: -26.87, lng: 26.67 },
  'Brits': { lat: -25.63, lng: 27.78 },
  'Hartbeespoort': { lat: -25.75, lng: 27.87 },
  'Sun City': { lat: -25.34, lng: 27.10 },
  'Lichtenburg': { lat: -26.15, lng: 26.16 },
  'Zeerust': { lat: -25.54, lng: 26.08 },
  'Vryburg': { lat: -26.96, lng: 24.73 },
  'Coligny': { lat: -26.33, lng: 25.81 },
  'Delareyville': { lat: -26.68, lng: 25.46 },
  'Schweizer-Reneke': { lat: -27.19, lng: 25.32 },
  'Christiana': { lat: -27.91, lng: 25.17 },
  'Wolmaransstad': { lat: -27.20, lng: 25.97 },
  'Ottoshoop': { lat: -25.72, lng: 25.97 },
  'Hartbeesfontein': { lat: -26.63, lng: 26.62 },
  'Koster': { lat: -25.87, lng: 27.21 },
  'Swartruggens': { lat: -25.65, lng: 26.68 },
  'Derby': { lat: -25.68, lng: 27.07 },
  'Groot Marico': { lat: -25.60, lng: 26.43 },
  'Sannieshof': { lat: -26.54, lng: 25.85 },
  'Stella': { lat: -26.11, lng: 24.55 },
  'Stilfontein': { lat: -26.84, lng: 26.75 },
  'Orkney': { lat: -26.98, lng: 26.68 },
  'Fochville': { lat: -26.48, lng: 27.50 },

  // Free State
  'Welkom': { lat: -27.98, lng: 26.74 },
  'Kroonstad': { lat: -27.65, lng: 27.23 },
  'Parys': { lat: -26.90, lng: 27.46 },
  'Heilbron': { lat: -27.28, lng: 27.97 },
  'Reitz': { lat: -27.80, lng: 28.43 },
  'Ficksburg': { lat: -28.88, lng: 27.88 },
  'Philippolis': { lat: -30.27, lng: 25.28 },
  'Trompsburg': { lat: -30.03, lng: 25.77 },
  'Bethlehem': { lat: -28.23, lng: 28.30 },
  'Harrismith': { lat: -28.27, lng: 29.13 },
  'Senekal': { lat: -28.32, lng: 27.63 },
  'Virginia': { lat: -28.10, lng: 26.87 },
  'Hennenman': { lat: -27.97, lng: 26.96 },
  'Vredefort': { lat: -27.00, lng: 27.35 },
  'Bothaville': { lat: -27.39, lng: 26.62 },
  'Viljoenskroon': { lat: -27.21, lng: 26.95 },
  'Frankfort': { lat: -27.27, lng: 28.50 },
  'Vrede': { lat: -27.43, lng: 29.17 },
  'Warden': { lat: -27.85, lng: 29.05 },
  'Marquard': { lat: -28.67, lng: 27.43 },
  'Ladybrand': { lat: -29.19, lng: 27.46 },
  'Fouriesburg': { lat: -28.62, lng: 28.22 },
  'Clarens': { lat: -28.52, lng: 28.42 },
  'Phuthaditjhaba': { lat: -28.53, lng: 28.82 },
  'Winburg': { lat: -28.53, lng: 27.00 },
  'Edenburg': { lat: -29.73, lng: 25.97 },
  'Smithfield': { lat: -30.22, lng: 26.53 },
  'Clocolan': { lat: -28.93, lng: 27.55 },
  'Petrus Steyn': { lat: -27.67, lng: 28.17 },
  'Bultfontein': { lat: -28.30, lng: 26.14 },
  'Hoopstad': { lat: -27.83, lng: 25.91 },
  'Theunissen': { lat: -28.40, lng: 26.71 },
  'Brandfort': { lat: -28.70, lng: 26.47 },
  'Van Reenen': { lat: -28.38, lng: 29.39 },

  // KwaZulu-Natal
  'Newcastle': { lat: -27.76, lng: 29.93 },
  'Richards Bay': { lat: -28.78, lng: 32.04 },
  'Vryheid': { lat: -27.77, lng: 30.80 },
  'Empangeni': { lat: -28.75, lng: 31.90 },
  'Eshowe': { lat: -28.89, lng: 31.47 },
  'Stanger': { lat: -29.34, lng: 31.29 },
  'KwaDukuza': { lat: -29.34, lng: 31.29 },
  'Ballito': { lat: -29.54, lng: 31.22 },
  'Umhlanga': { lat: -29.73, lng: 31.08 },
  'Pinetown': { lat: -29.82, lng: 30.86 },
  'Chatsworth': { lat: -29.92, lng: 30.89 },
  'Port Shepstone': { lat: -30.74, lng: 30.45 },
  'Margate': { lat: -30.86, lng: 30.37 },
  'Ladysmith': { lat: -28.56, lng: 29.78 },
  'Dundee': { lat: -28.17, lng: 30.23 },
  'Kokstad': { lat: -30.55, lng: 29.42 },
  'Greytown': { lat: -29.06, lng: 30.59 },
  'Howick': { lat: -29.48, lng: 30.23 },
  'Mooi River': { lat: -29.21, lng: 30.00 },
  'Estcourt': { lat: -29.00, lng: 29.88 },
  'Winterton': { lat: -28.81, lng: 29.53 },
  'Hluhluwe': { lat: -28.03, lng: 32.27 },
  'Mtubatuba': { lat: -28.42, lng: 32.19 },
  'Nongoma': { lat: -27.90, lng: 31.65 },
  'Ulundi': { lat: -28.31, lng: 31.42 },
  'Tongaat': { lat: -29.57, lng: 31.12 },
  'Verulam': { lat: -29.64, lng: 31.05 },
  'Phoenix': { lat: -29.71, lng: 31.00 },
  'Umlazi': { lat: -29.97, lng: 30.89 },
  'Ixopo': { lat: -30.15, lng: 30.06 },
  'Scottburgh': { lat: -30.29, lng: 30.75 },
  'Amanzimtoti': { lat: -30.05, lng: 30.88 },
  'Bergville': { lat: -28.73, lng: 29.36 },
  'Dannhauser': { lat: -28.01, lng: 30.05 },
  'Glencoe': { lat: -28.17, lng: 30.15 },
  'Paulpietersburg': { lat: -27.42, lng: 30.82 },
  'Pongola': { lat: -27.38, lng: 31.62 },
  'uMsinga': { lat: -28.75, lng: 30.45 },
  'Msinga': { lat: -28.75, lng: 30.45 },
  'Weenen': { lat: -28.85, lng: 30.07 },
  'Colenso': { lat: -28.74, lng: 29.82 },
  'Utrecht': { lat: -27.66, lng: 30.33 },

  // Eastern Cape
  'East London': { lat: -33.02, lng: 27.91 },
  'Mthatha': { lat: -31.59, lng: 28.78 },
  'Umtata': { lat: -31.59, lng: 28.78 },
  'Queenstown': { lat: -31.90, lng: 26.88 },
  'Grahamstown': { lat: -33.31, lng: 26.52 },
  'Makhanda': { lat: -33.31, lng: 26.52 },
  "King William's Town": { lat: -32.88, lng: 27.39 },
  'Bhisho': { lat: -32.85, lng: 27.44 },
  'Butterworth': { lat: -32.33, lng: 28.15 },
  'Cradock': { lat: -32.18, lng: 25.62 },
  'Aliwal North': { lat: -30.69, lng: 26.71 },
  'Sterkstroom': { lat: -31.57, lng: 26.53 },
  'Jamestown': { lat: -31.12, lng: 26.80 },
  'Graaff-Reinet': { lat: -32.25, lng: 24.53 },
  'Fort Beaufort': { lat: -32.78, lng: 26.64 },
  'Adelaide': { lat: -32.69, lng: 26.30 },
  'Tarkastad': { lat: -32.00, lng: 26.24 },
  'Cathcart': { lat: -32.30, lng: 27.15 },
  'Stutterheim': { lat: -32.57, lng: 27.42 },
  'Komani': { lat: -31.90, lng: 26.88 },
  'Humansdorp': { lat: -33.77, lng: 24.77 },
  'Joubertina': { lat: -33.83, lng: 23.85 },
  'Willowmore': { lat: -33.29, lng: 23.49 },
  'Aberdeen': { lat: -32.47, lng: 24.07 },
  'Somerset East': { lat: -32.72, lng: 25.59 },
  'Cookhouse': { lat: -32.75, lng: 25.80 },
  'Middelburg EC': { lat: -31.49, lng: 25.01 },
  'Hofmeyr': { lat: -31.63, lng: 25.81 },
  'Elliot': { lat: -31.34, lng: 27.85 },
  'Dordrecht': { lat: -31.37, lng: 27.05 },
  'Barkly East': { lat: -30.97, lng: 27.60 },
  'Steynsburg': { lat: -31.30, lng: 25.83 },
  'Nieu-Bethesda': { lat: -31.88, lng: 24.56 },
  'Pearston': { lat: -32.50, lng: 25.11 },
  'Jansenville': { lat: -32.95, lng: 24.68 },
  'Jeffreys Bay': { lat: -33.93, lng: 24.92 },

  // Western Cape
  'Stellenbosch': { lat: -33.94, lng: 18.86 },
  'Paarl': { lat: -33.72, lng: 18.97 },
  'George': { lat: -33.96, lng: 22.46 },
  'Bredasdorp': { lat: -34.53, lng: 20.04 },
  'Worcester': { lat: -33.65, lng: 19.45 },
  'Malmesbury': { lat: -33.46, lng: 18.73 },
  'Hermanus': { lat: -34.42, lng: 19.24 },
  'Knysna': { lat: -34.04, lng: 23.05 },
  'Mossel Bay': { lat: -34.18, lng: 22.14 },
  'Oudtshoorn': { lat: -33.59, lng: 22.20 },
  'Beaufort West': { lat: -32.35, lng: 22.58 },
  'Somerset West': { lat: -34.08, lng: 18.85 },
  'Strand': { lat: -34.11, lng: 18.83 },
  'Franschhoek': { lat: -33.91, lng: 19.12 },
  'Wellington': { lat: -33.64, lng: 19.01 },
  'Saldanha': { lat: -33.00, lng: 17.93 },
  'Langebaan': { lat: -33.09, lng: 18.02 },
  'Citrusdal': { lat: -32.59, lng: 19.01 },
  'Clanwilliam': { lat: -32.18, lng: 18.89 },
  'Plettenberg Bay': { lat: -34.05, lng: 23.37 },
  'Moorreesburg': { lat: -33.15, lng: 18.67 },
  'Kraaifontein': { lat: -33.85, lng: 18.73 },
  'Kuils River': { lat: -34.00, lng: 18.68 },
  'Kuilsrivier': { lat: -34.00, lng: 18.68 },
  'Brackenfell': { lat: -33.88, lng: 18.68 },
  'Durbanville': { lat: -33.83, lng: 18.65 },
  'Bellville': { lat: -33.90, lng: 18.63 },
  'Goodwood': { lat: -33.91, lng: 18.56 },
  'Parow': { lat: -33.90, lng: 18.57 },
  'Milnerton': { lat: -33.87, lng: 18.51 },
  'Table View': { lat: -33.82, lng: 18.48 },
  'Bloubergstrand': { lat: -33.80, lng: 18.45 },
  'Constantia': { lat: -34.02, lng: 18.43 },
  'Tokai': { lat: -34.06, lng: 18.44 },
  'Fish Hoek': { lat: -34.14, lng: 18.43 },
  'Simons Town': { lat: -34.19, lng: 18.43 },
  "Simon's Town": { lat: -34.19, lng: 18.43 },
  'Hout Bay': { lat: -34.04, lng: 18.35 },
  'Camps Bay': { lat: -33.95, lng: 18.38 },
  'Nyanga': { lat: -33.99, lng: 18.58 },
  'Khayelitsha': { lat: -34.04, lng: 18.67 },
  'Mitchells Plain': { lat: -34.05, lng: 18.62 },
  'Gugulethu': { lat: -33.98, lng: 18.57 },
  'Langa': { lat: -33.95, lng: 18.53 },
  'Athlone': { lat: -33.96, lng: 18.50 },
  'Grassy Park': { lat: -34.06, lng: 18.50 },
  'Wynberg': { lat: -34.01, lng: 18.47 },
  'Claremont': { lat: -33.98, lng: 18.47 },
  'Rondebosch': { lat: -33.96, lng: 18.47 },
  'Mowbray': { lat: -33.95, lng: 18.47 },
  'Observatory': { lat: -33.94, lng: 18.47 },
  'Woodstock': { lat: -33.93, lng: 18.45 },
  'Philippi': { lat: -34.03, lng: 18.58 },
  'Delft': { lat: -33.97, lng: 18.63 },
  'Blue Downs': { lat: -34.00, lng: 18.66 },
  'Eerste River': { lat: -34.01, lng: 18.71 },
  'Macassar': { lat: -34.07, lng: 18.75 },
  'Gordons Bay': { lat: -34.16, lng: 18.86 },
  'Grabouw': { lat: -34.15, lng: 19.01 },
  'Villiersdorp': { lat: -33.99, lng: 19.29 },
  'Ceres': { lat: -33.37, lng: 19.31 },
  'Tulbagh': { lat: -33.28, lng: 19.14 },
  'Robertson': { lat: -33.80, lng: 19.89 },
  'Montagu': { lat: -33.79, lng: 20.12 },
  'Swellendam': { lat: -34.02, lng: 20.44 },
  'Riversdale': { lat: -34.09, lng: 21.26 },
  'Ladismith': { lat: -33.49, lng: 21.27 },
  'Calitzdorp': { lat: -33.53, lng: 21.69 },
  'Prince Albert': { lat: -33.21, lng: 22.03 },
  'Sedgefield': { lat: -34.00, lng: 22.79 },
  'Wilderness': { lat: -33.99, lng: 22.58 },
  'Vredenburg': { lat: -33.09, lng: 17.99 },
  'Piketberg': { lat: -32.90, lng: 18.76 },
  'Darling': { lat: -33.38, lng: 18.39 },
  'Atlantis': { lat: -33.66, lng: 18.49 },
  'Mamre': { lat: -33.52, lng: 18.40 },

  // Northern Cape
  'Upington': { lat: -28.45, lng: 21.27 },
  'Springbok': { lat: -29.67, lng: 17.88 },
  'De Aar': { lat: -30.65, lng: 24.01 },
  'Kuruman': { lat: -27.45, lng: 23.43 },
  'Colesburg': { lat: -30.72, lng: 25.10 },
  'Kathu': { lat: -27.70, lng: 23.05 },
  'Jan Kempdorp': { lat: -27.93, lng: 24.83 },
  'Hartswater': { lat: -27.78, lng: 24.80 },
  'Warrenton': { lat: -28.11, lng: 24.86 },
  'Douglas': { lat: -29.05, lng: 23.77 },
  'Griquatown': { lat: -28.44, lng: 23.26 },
  'Calvinia': { lat: -31.47, lng: 19.78 },
  'Carnarvon': { lat: -30.97, lng: 22.13 },
  'Sutherland': { lat: -32.40, lng: 20.66 },
  'Victoria West': { lat: -31.40, lng: 23.12 },
  'Prieska': { lat: -29.66, lng: 22.75 },
  'Hanover': { lat: -31.08, lng: 24.46 },
  'Richmond NC': { lat: -31.43, lng: 24.00 },
  'Kakamas': { lat: -28.77, lng: 20.62 },
  'Keimoes': { lat: -28.70, lng: 20.97 },
  'Pofadder': { lat: -29.13, lng: 19.39 },
  'Port Nolloth': { lat: -29.26, lng: 16.87 },
  'Alexander Bay': { lat: -28.59, lng: 16.47 },
  'Colesberg': { lat: -30.72, lng: 25.10 },
  'Norvalspont': { lat: -30.64, lng: 25.40 },
  'Hopetown': { lat: -29.62, lng: 24.07 },
  'Britstown': { lat: -30.57, lng: 23.50 },
  'Kenhardt': { lat: -29.35, lng: 21.15 },
  'Postmasburg': { lat: -28.33, lng: 23.08 },
  'Danielskuil': { lat: -28.19, lng: 23.56 },
  'Barkly West': { lat: -28.54, lng: 24.53 },
};

export const PROVINCE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'Gauteng': { lat: -26.27, lng: 28.11 },
  'Limpopo': { lat: -23.40, lng: 29.42 },
  'Mpumalanga': { lat: -25.57, lng: 30.30 },
  'North West': { lat: -26.66, lng: 25.28 },
  'Free State': { lat: -29.08, lng: 26.15 },
  'KwaZulu-Natal': { lat: -29.01, lng: 30.29 },
  'Eastern Cape': { lat: -32.00, lng: 26.50 },
  'Western Cape': { lat: -33.23, lng: 19.32 },
  'Northern Cape': { lat: -29.10, lng: 21.25 },
};

const townLookup = new Map<string, { lat: number; lng: number }>();
for (const [name, coords] of Object.entries(SA_TOWN_COORDS)) {
  townLookup.set(name.toLowerCase(), coords);
}

export function lookupTown(town: string): { lat: number; lng: number } | null {
  if (!town) return null;
  const key = town.trim().toLowerCase();
  const direct = townLookup.get(key);
  if (direct) return direct;
  // Try stripping common suffixes/prefixes from farm-attack data
  const stripped = key
    .replace(/\s*(farm|smallholding|plot|plaas|district|area|near|outside|between)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped !== key) {
    const match = townLookup.get(stripped);
    if (match) return match;
  }
  // Try partial match — if the town name contains a known town
  for (const [name, coords] of townLookup) {
    if (key.includes(name) || name.includes(key)) {
      return coords;
    }
  }
  return null;
}

export function lookupProvince(province: string): { lat: number; lng: number } | null {
  if (!province) return null;
  const key = Object.keys(PROVINCE_CENTROIDS).find(
    k => k.toLowerCase() === province.toLowerCase(),
  );
  return key ? PROVINCE_CENTROIDS[key]! : null;
}

export function gaussianJitter(scale: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2) * scale;
}

// South Africa's real bounding box, with a small margin. Anything outside this
// is not a South African coordinate and must not be plotted as one.
const SA_BOUNDS = { minLng: 16.0, maxLng: 33.5, minLat: -35.0, maxLat: -22.0 };

function isPlottable(lng: unknown, lat: unknown): boolean {
  // Number.isFinite rejects NaN and Infinity. The previous `!= null` test did
  // NOT: `NaN != null` is true, so once geocoding started returning NaN for
  // unresolved locations (instead of fabricating random coordinates), every
  // such incident produced a GeoJSON feature with NaN coordinates. MapLibre
  // silently drops those, so the map showed a handful of dots while the badge
  // still counted every feature. Silent drop is exactly the failure mode that
  // made this bug so hard to see.
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  const x = lng as number;
  const y = lat as number;
  if (x === 0 && y === 0) return false;
  return x >= SA_BOUNDS.minLng && x <= SA_BOUNDS.maxLng
    && y >= SA_BOUNDS.minLat && y <= SA_BOUNDS.maxLat;
}

export function resolveCoords(inc: {
  town?: string | null;
  lng?: number | null;
  lat?: number | null;
  province?: string | null;
}): { lng: number; lat: number } | null {
  if (inc.town) {
    const tc = lookupTown(inc.town);
    if (tc) return { lat: tc.lat + gaussianJitter(0.02), lng: tc.lng + gaussianJitter(0.02) };
  }
  if (isPlottable(inc.lng, inc.lat)) {
    return { lng: inc.lng as number, lat: inc.lat as number };
  }
  const pc = lookupProvince(inc.province ?? '');
  if (pc) return { lat: pc.lat + gaussianJitter(0.3), lng: pc.lng + gaussianJitter(0.3) };
  return null;
}
