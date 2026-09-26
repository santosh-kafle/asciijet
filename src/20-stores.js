// Weapons, fuel tanks and pods. Masses and sizes are published figures for the variant named;
// values marked est are open-source estimates. L length (m), d body diameter (m), fin span (m).
// shape picks the mesh builder; mat the body colour.
const STORES = {};
const S = (key, o) => { STORES[key] = { key, ...o }; };

// Air-to-air missiles
S('AIM-120C', { name: 'AIM-120C-7 AMRAAM', cat: 'Air-to-air', kg: 161, L: 3.66, d: 0.178, span: 0.45, shape: 'aam', mat: 'white', guide: 'Active radar', range: 'over 100 km', origin: 'US' });
S('AIM-120D', { name: 'AIM-120D AMRAAM', cat: 'Air-to-air', kg: 161, L: 3.66, d: 0.178, span: 0.45, shape: 'aam', mat: 'white', guide: 'Active radar, two-way datalink', range: 'about 160 km', origin: 'US' });
S('AIM-9X', { name: 'AIM-9X Sidewinder', cat: 'Air-to-air', kg: 85, L: 3.02, d: 0.127, span: 0.35, shape: 'aam', mat: 'white', guide: 'Imaging infrared, thrust vectoring', range: 'about 35 km', origin: 'US' });
S('AIM-9M', { name: 'AIM-9M Sidewinder', cat: 'Air-to-air', kg: 86, L: 2.87, d: 0.127, span: 0.63, shape: 'aam', canard: 1, mat: 'white', guide: 'Infrared', range: 'about 18 km', origin: 'US' });
S('AIM-7M', { name: 'AIM-7M Sparrow', cat: 'Air-to-air', kg: 231, L: 3.66, d: 0.203, span: 1.0, shape: 'aam', wings: 1, mat: 'white', guide: 'Semi-active radar', range: 'about 70 km', origin: 'US' });
S('AIM-54C', { name: 'AIM-54C Phoenix', cat: 'Air-to-air', kg: 463, L: 3.96, d: 0.38, span: 0.91, shape: 'aam', mat: 'white', guide: 'Semi-active, then active radar', range: 'about 190 km', origin: 'US' });
S('R-77', { name: 'R-77-1 (RVV-SD)', cat: 'Air-to-air', kg: 190, L: 3.71, d: 0.2, span: 0.7, shape: 'aam', grid: 1, mat: 'white', guide: 'Active radar, grid-fin tail', range: 'about 110 km', origin: 'RU' });
S('R-73', { name: 'R-73 (AA-11 Archer)', cat: 'Air-to-air', kg: 105, L: 2.9, d: 0.17, span: 0.51, shape: 'aam', canard: 1, mat: 'white', guide: 'Infrared, thrust vectoring', range: 'about 30 km', origin: 'RU' });
S('R-27ER', { name: 'R-27ER (AA-10 Alamo)', cat: 'Air-to-air', kg: 350, L: 4.78, d: 0.26, span: 0.8, shape: 'aam', wings: 1, mat: 'white', guide: 'Semi-active radar', range: 'about 95 km', origin: 'RU' });
S('R-60M', { name: 'R-60M (AA-8 Aphid)', cat: 'Air-to-air', kg: 44, L: 2.14, d: 0.12, span: 0.39, shape: 'aam', canard: 1, mat: 'white', guide: 'Infrared', range: 'about 8 km', origin: 'RU' });
S('R-13M', { name: 'R-13M (AA-2 Atoll)', cat: 'Air-to-air', kg: 90, L: 2.87, d: 0.127, span: 0.53, shape: 'aam', canard: 1, mat: 'white', guide: 'Infrared', range: 'about 15 km', origin: 'RU', est: 1 });
S('R-33', { name: 'R-33 (AA-9 Amos)', cat: 'Air-to-air', kg: 490, L: 4.15, d: 0.38, span: 1.16, shape: 'aam', wings: 1, mat: 'white', guide: 'Inertial, semi-active radar', range: 'about 160 km', origin: 'RU' });
S('R-37M', { name: 'R-37M (AA-13 Axehead)', cat: 'Air-to-air', kg: 510, L: 4.2, d: 0.38, span: 0.7, shape: 'aam', mat: 'white', guide: 'Inertial, active radar', range: 'about 300 km', origin: 'RU', est: 1 });
S('Meteor', { name: 'MBDA Meteor', cat: 'Air-to-air', kg: 190, L: 3.65, d: 0.178, span: 0.4, shape: 'aam', ramjet: 1, mat: 'white', guide: 'Active radar, ramjet', range: 'over 150 km', origin: 'EU' });
S('MICA', { name: 'MBDA MICA EM', cat: 'Air-to-air', kg: 112, L: 3.1, d: 0.16, span: 0.56, shape: 'aam', wings: 1, mat: 'white', guide: 'Active radar', range: 'about 80 km', origin: 'FR' });
S('IRIS-T', { name: 'IRIS-T', cat: 'Air-to-air', kg: 87.4, L: 2.94, d: 0.127, span: 0.45, shape: 'aam', mat: 'white', guide: 'Imaging infrared, thrust vectoring', range: 'about 25 km', origin: 'DE' });
S('Magic 2', { name: 'R.550 Magic 2', cat: 'Air-to-air', kg: 89, L: 2.75, d: 0.157, span: 0.66, shape: 'aam', canard: 1, mat: 'white', guide: 'Infrared', range: 'about 15 km', origin: 'FR' });
S('PL-15', { name: 'PL-15', cat: 'Air-to-air', kg: 210, L: 4.0, d: 0.203, span: 0.4, shape: 'aam', mat: 'white', guide: 'Active radar (AESA seeker), dual pulse', range: 'about 200 km', origin: 'CN', est: 1 });
S('PL-10', { name: 'PL-10', cat: 'Air-to-air', kg: 89, L: 3.0, d: 0.16, span: 0.4, shape: 'aam', mat: 'white', guide: 'Imaging infrared, thrust vectoring', range: 'about 20 km', origin: 'CN', est: 1 });

// Air-to-ground: bombs and guided bombs
S('Mk 82', { name: 'Mk 82 500 lb bomb', cat: 'Bomb', kg: 241, L: 2.22, d: 0.273, span: 0.38, shape: 'bomb', mat: 'olive', guide: 'Unguided', origin: 'US' });
S('Mk 84', { name: 'Mk 84 2,000 lb bomb', cat: 'Bomb', kg: 925, L: 3.28, d: 0.458, span: 0.64, shape: 'bomb', mat: 'olive', guide: 'Unguided', origin: 'US' });
S('GBU-12', { name: 'GBU-12 Paveway II', cat: 'Guided bomb', kg: 230, L: 3.27, d: 0.273, span: 1.49, shape: 'lgb', mat: 'olive', guide: 'Laser', origin: 'US' });
S('GBU-10', { name: 'GBU-10 Paveway II', cat: 'Guided bomb', kg: 934, L: 4.35, d: 0.458, span: 1.68, shape: 'lgb', mat: 'olive', guide: 'Laser', origin: 'US' });
S('GBU-38', { name: 'GBU-38 JDAM (500 lb)', cat: 'Guided bomb', kg: 253, L: 2.35, d: 0.273, span: 0.45, shape: 'jdam', mat: 'olive', guide: 'GPS / INS', range: 'up to 24 km', origin: 'US' });
S('GBU-32', { name: 'GBU-32 JDAM (1,000 lb)', cat: 'Guided bomb', kg: 460, L: 3.04, d: 0.36, span: 0.5, shape: 'jdam', mat: 'olive', guide: 'GPS / INS', range: 'up to 24 km', origin: 'US' });
S('GBU-31', { name: 'GBU-31 JDAM (2,000 lb)', cat: 'Guided bomb', kg: 934, L: 3.88, d: 0.458, span: 0.64, shape: 'jdam', mat: 'olive', guide: 'GPS / INS', range: 'up to 28 km', origin: 'US' });
S('GBU-39', { name: 'GBU-39 Small Diameter Bomb', cat: 'Guided bomb', kg: 129, L: 1.8, d: 0.19, span: 0.2, shape: 'sdb', mat: 'white', guide: 'GPS / INS, pop-out wings', range: 'over 110 km', origin: 'US' });
S('GBU-57', { name: 'GBU-57 Massive Ordnance Penetrator', cat: 'Guided bomb', kg: 13600, L: 6.2, d: 0.8, span: 1.6, shape: 'jdam', mat: 'olive', guide: 'GPS / INS', note: 'Bunker buster: over 60 m of earth.', origin: 'US' });
S('CBU-97', { name: 'CBU-97 Sensor Fuzed Weapon', cat: 'Cluster bomb', kg: 420, L: 2.34, d: 0.4, span: 0.6, shape: 'bomb', mat: 'olive', guide: 'Unguided dispenser, 40 guided skeets', origin: 'US' });
S('B61', { name: 'B61-12 nuclear bomb', cat: 'Nuclear', kg: 374, L: 3.6, d: 0.34, span: 0.5, shape: 'jdam', mat: 'white', guide: 'INS tail kit', note: 'Variable yield.', origin: 'US', est: 1 });
S('B83', { name: 'B83 nuclear bomb', cat: 'Nuclear', kg: 1100, L: 3.7, d: 0.46, span: 0.6, shape: 'bomb', mat: 'white', guide: 'Parachute retarded', note: 'Up to 1.2 megatons.', origin: 'US' });
S('Paveway IV', { name: 'Paveway IV', cat: 'Guided bomb', kg: 227, L: 3.3, d: 0.273, span: 0.9, shape: 'lgb', mat: 'olive', guide: 'GPS / INS and laser', origin: 'UK', est: 1 });
S('AASM', { name: 'AASM Hammer (SBU-38)', cat: 'Guided bomb', kg: 340, L: 3.1, d: 0.3, span: 0.9, shape: 'lgb', mat: 'sand', guide: 'GPS / INS, rocket boosted', range: 'up to 70 km', origin: 'FR' });
S('1000 lb MC', { name: '1,000 lb MC bomb', cat: 'Bomb', kg: 454, L: 2.2, d: 0.43, span: 0.5, shape: 'bomb', mat: 'olive', guide: 'Unguided', origin: 'UK', est: 1 });
S('FAB-500', { name: 'FAB-500 M-62', cat: 'Bomb', kg: 500, L: 2.47, d: 0.4, span: 0.6, shape: 'bomb', mat: 'olive', guide: 'Unguided', origin: 'RU' });
S('FAB-250', { name: 'FAB-250 M-62', cat: 'Bomb', kg: 250, L: 1.96, d: 0.325, span: 0.45, shape: 'bomb', mat: 'olive', guide: 'Unguided', origin: 'RU' });
S('KAB-500L', { name: 'KAB-500L', cat: 'Guided bomb', kg: 525, L: 3.05, d: 0.35, span: 0.75, shape: 'lgb', mat: 'olive', guide: 'Laser', origin: 'RU' });

S('Super 530D', { name: 'Super 530D', cat: 'Air-to-air', kg: 270, L: 3.8, d: 0.263, span: 0.62, shape: 'aam', mat: 'white', guide: 'Semi-active radar', range: 'about 40 km', origin: 'FR' });

// Air-to-surface missiles
S('AGM-88', { name: 'AGM-88E AARGM', cat: 'Anti-radiation', kg: 361, L: 4.17, d: 0.254, span: 1.13, shape: 'aam', wings: 1, mat: 'white', guide: 'Passive radar homing, GPS, radar', range: 'over 110 km', origin: 'US' });
S('AGM-65', { name: 'AGM-65G Maverick', cat: 'Air-to-surface', kg: 304, L: 2.49, d: 0.3, span: 0.72, shape: 'aam', wings: 1, glass: 1, mat: 'white', guide: 'Imaging infrared', range: 'about 22 km', origin: 'US' });
S('AGM-84', { name: 'AGM-84 Harpoon', cat: 'Anti-ship', kg: 519, L: 3.84, d: 0.34, span: 0.91, shape: 'aam', wings: 1, mat: 'white', guide: 'Active radar, sea skimming', range: 'about 220 km', origin: 'US' });
S('AGM-158', { name: 'AGM-158 JASSM', cat: 'Cruise missile', kg: 1020, L: 4.27, d: 0.55, h: 0.45, span: 0.9, shape: 'cruise', mat: 'skin2', guide: 'GPS / INS, infrared terminal', range: 'about 370 km (ER: 925 km)', origin: 'US' });
S('AGM-86B', { name: 'AGM-86B ALCM', cat: 'Cruise missile', kg: 1430, L: 6.32, d: 0.62, span: 1.2, shape: 'cruise', mat: 'white', guide: 'INS, terrain contour matching', range: 'about 2,400 km', note: 'Nuclear armed.', origin: 'US' });
S('Storm Shadow', { name: 'Storm Shadow / SCALP-EG', cat: 'Cruise missile', kg: 1300, L: 5.1, d: 0.63, h: 0.48, span: 0.9, shape: 'cruise', mat: 'skin2', guide: 'INS, GPS, terrain matching, infrared', range: 'about 560 km', origin: 'UK/FR' });
S('Taurus', { name: 'Taurus KEPD 350', cat: 'Cruise missile', kg: 1400, L: 5.1, d: 0.63, h: 0.32, span: 1.0, shape: 'cruise', mat: 'skin2', guide: 'INS, GPS, terrain matching, infrared', range: 'about 500 km', origin: 'DE/SE' });
S('ASMP-A', { name: 'ASMP-A', cat: 'Nuclear', kg: 860, L: 5.38, d: 0.38, span: 0.9, shape: 'aam', ramjet: 1, mat: 'white', guide: 'Inertial, ramjet', range: 'about 500 km', note: '300 kt warhead.', origin: 'FR', est: 1 });
S('Brimstone', { name: 'Brimstone (3-round launcher)', cat: 'Air-to-surface', kg: 150, L: 1.8, d: 0.3, span: 0.4, shape: 'pod', mat: 'skin2', guide: 'Millimetre-wave radar, laser', range: 'about 20 km', note: 'Launcher with three 48.5 kg missiles.', origin: 'UK', est: 1 });
S('RBS 15F', { name: 'RBS 15F', cat: 'Anti-ship', kg: 800, L: 4.35, d: 0.5, span: 1.4, shape: 'cruise', mat: 'white', guide: 'Inertial, active radar', range: 'over 200 km', origin: 'SE' });
S('Kh-31P', { name: 'Kh-31P (AS-17 Krypton)', cat: 'Anti-radiation', kg: 600, L: 4.7, d: 0.36, span: 0.91, shape: 'aam', wings: 1, ramjet: 1, mat: 'white', guide: 'Passive radar, ramjet', range: 'about 110 km', origin: 'RU' });
S('Kh-59MK2', { name: 'Kh-59MK2', cat: 'Cruise missile', kg: 770, L: 4.2, d: 0.38, span: 1.3, shape: 'cruise', mat: 'white', guide: 'INS, GLONASS, optical', range: 'about 290 km', origin: 'RU', est: 1 });
S('Kh-55', { name: 'Kh-55 (AS-15 Kent)', cat: 'Cruise missile', kg: 1185, L: 6.04, d: 0.514, span: 1.0, shape: 'cruise', mat: 'white', guide: 'INS, terrain matching', range: 'about 2,500 km', note: 'Nuclear armed.', origin: 'RU' });
S('Kh-101', { name: 'Kh-101', cat: 'Cruise missile', kg: 2400, L: 7.45, d: 0.74, h: 0.6, span: 1.2, shape: 'cruise', mat: 'white', guide: 'INS, GLONASS, optical terminal', range: 'about 2,800 km', origin: 'RU', est: 1 });
S('Kh-22', { name: 'Kh-22 (AS-4 Kitchen)', cat: 'Anti-ship', kg: 5820, L: 11.67, d: 0.92, span: 3.0, shape: 'heavy', mat: 'metal', guide: 'Inertial, active radar', range: 'about 600 km', note: 'Liquid-fuel rocket, Mach 4.6.', origin: 'RU' });
S('Kh-47M2', { name: 'Kh-47M2 Kinzhal', cat: 'Air-launched ballistic', kg: 4300, L: 7.2, d: 1.0, span: 1.3, shape: 'aam', mat: 'white', guide: 'Inertial, GLONASS, optical', range: 'about 2,000 km (claimed)', note: 'Air-launched ballistic missile.', origin: 'RU', est: 1 });
S('Kh-15', { name: 'Kh-15 (AS-16 Kickback)', cat: 'Nuclear', kg: 1200, L: 4.78, d: 0.455, span: 0.92, shape: 'aam', mat: 'white', guide: 'Inertial', range: 'about 300 km', origin: 'RU' });
S('Blue Steel', { name: 'Avro Blue Steel', cat: 'Nuclear', kg: 7700, L: 10.7, d: 1.27, span: 4.0, shape: 'heavy', mat: 'white', guide: 'Inertial', range: 'about 240 km', note: '1.1 megaton warhead. Retired 1970.', origin: 'UK' });
S('YJ-12', { name: 'YJ-12', cat: 'Anti-ship', kg: 2500, L: 6.3, d: 0.6, span: 1.4, shape: 'aam', ramjet: 1, mat: 'white', guide: 'Inertial, active radar', range: 'about 400 km', origin: 'CN', est: 1 });

// Fuel tanks (kg = empty tank, fuel = JP-8 at 0.80 kg/L) and pods
S('Tank 600', { name: '600 US gal drop tank', cat: 'Fuel tank', kg: 180, fuel: 1817, L: 5.9, d: 0.84, shape: 'tank', mat: 'tank', origin: 'US', est: 1 });
S('Tank 610', { name: '610 US gal drop tank', cat: 'Fuel tank', kg: 180, fuel: 1847, L: 6.1, d: 0.84, shape: 'tank', mat: 'tank', origin: 'US', est: 1 });
S('Tank 480', { name: '480 US gal drop tank', cat: 'Fuel tank', kg: 160, fuel: 1453, L: 5.5, d: 0.72, shape: 'tank', mat: 'tank', origin: 'US', est: 1 });
S('Tank 370', { name: '370 US gal drop tank', cat: 'Fuel tank', kg: 145, fuel: 1120, L: 4.9, d: 0.68, shape: 'tank', mat: 'tank', origin: 'US', est: 1 });
S('Tank 330', { name: '330 US gal drop tank', cat: 'Fuel tank', kg: 130, fuel: 1000, L: 4.9, d: 0.66, shape: 'tank', mat: 'tank', origin: 'US', est: 1 });
S('Tank 300', { name: '300 US gal drop tank', cat: 'Fuel tank', kg: 120, fuel: 908, L: 4.4, d: 0.63, shape: 'tank', mat: 'tank', origin: 'US', est: 1 });
S('Tank 1000L', { name: '1,000 L drop tank', cat: 'Fuel tank', kg: 110, fuel: 800, L: 4.2, d: 0.6, shape: 'tank', mat: 'tank', origin: 'EU', est: 1 });
S('Tank 1250L', { name: '1,250 L drop tank', cat: 'Fuel tank', kg: 120, fuel: 1000, L: 4.6, d: 0.64, shape: 'tank', mat: 'tank', origin: 'FR', est: 1 });
S('Tank 2000L', { name: '2,000 L drop tank', cat: 'Fuel tank', kg: 170, fuel: 1600, L: 5.6, d: 0.78, shape: 'tank', mat: 'tank', origin: 'FR', est: 1 });
S('PTB-1500', { name: 'PTB-1500 centreline tank', cat: 'Fuel tank', kg: 160, fuel: 1200, L: 5.4, d: 0.72, shape: 'tank', mat: 'tank', origin: 'RU', est: 1 });
S('PTB-2000', { name: 'PTB-2000 drop tank', cat: 'Fuel tank', kg: 190, fuel: 1600, L: 5.8, d: 0.8, shape: 'tank', mat: 'tank', origin: 'RU', est: 1 });
S('PTB-2500', { name: 'PTB-2500 drop tank', cat: 'Fuel tank', kg: 220, fuel: 2000, L: 6.6, d: 0.85, shape: 'tank', mat: 'tank', origin: 'RU', est: 1 });
S('PTB-490', { name: 'PTB-490 drop tank', cat: 'Fuel tank', kg: 70, fuel: 390, L: 3.3, d: 0.5, shape: 'tank', mat: 'tank', origin: 'RU', est: 1 });
S('PTB-800', { name: 'PTB-800 centreline tank', cat: 'Fuel tank', kg: 100, fuel: 640, L: 4.0, d: 0.56, shape: 'tank', mat: 'tank', origin: 'RU', est: 1 });
S('Tank 1300L', { name: '1,300 L drop tank', cat: 'Fuel tank', kg: 125, fuel: 1040, L: 4.9, d: 0.64, shape: 'tank', mat: 'tank', origin: 'FR', est: 1 });
S('Tank 1500L', { name: '1,500 L drop tank', cat: 'Fuel tank', kg: 140, fuel: 1200, L: 5.2, d: 0.68, shape: 'tank', mat: 'tank', origin: 'EU', est: 1 });
S('Tank 1100L', { name: '1,100 L drop tank', cat: 'Fuel tank', kg: 115, fuel: 880, L: 4.4, d: 0.62, shape: 'tank', mat: 'tank', origin: 'SE', est: 1 });
S('Sniper', { name: 'AN/AAQ-33 Sniper ATP', cat: 'Targeting pod', kg: 202, L: 2.39, d: 0.3, shape: 'pod', mat: 'skin2', guide: 'Laser designator, FLIR, TV', origin: 'US' });
S('LITENING', { name: 'LITENING targeting pod', cat: 'Targeting pod', kg: 200, L: 2.2, d: 0.41, shape: 'pod', mat: 'skin2', guide: 'Laser designator, FLIR', origin: 'IL/US' });
S('TALIOS', { name: 'TALIOS targeting pod', cat: 'Targeting pod', kg: 265, L: 2.5, d: 0.35, shape: 'pod', mat: 'skin2', guide: 'Laser designator, FLIR', origin: 'FR', est: 1 });
S('HTS', { name: 'AN/ASQ-213 HARM Targeting System', cat: 'Sensor pod', kg: 45, L: 1.44, d: 0.2, shape: 'pod', mat: 'skin2', guide: 'Radar emitter location', origin: 'US' });
S('ALQ-184', { name: 'AN/ALQ-184 ECM pod', cat: 'Jamming pod', kg: 215, L: 3.95, d: 0.3, shape: 'pod', mat: 'skin2', guide: 'Self-protection jamming', origin: 'US', est: 1 });
S('LANTIRN', { name: 'AN/AAQ-13/14 LANTIRN', cat: 'Targeting pod', kg: 236, L: 2.5, d: 0.38, shape: 'pod', mat: 'skin2', guide: 'Navigation FLIR, laser designator', origin: 'US' });
S('Khibiny', { name: 'L175V Khibiny wingtip pod', cat: 'Jamming pod', kg: 90, L: 2.3, d: 0.25, shape: 'pod', mat: 'skin2', guide: 'Electronic warfare', origin: 'RU', est: 1 });
S('ATFLIR', { name: 'AN/ASQ-228 ATFLIR', cat: 'Targeting pod', kg: 191, L: 1.83, d: 0.33, shape: 'pod', mat: 'skin2', guide: 'Laser designator, FLIR', origin: 'US' });
S('Tank 2250L', { name: '2,250 L drop tank', cat: 'Fuel tank', kg: 190, fuel: 1800, L: 6.3, d: 0.8, shape: 'tank', mat: 'tank', origin: 'UK/DE', est: 1 });
S('Rack SDB', { name: 'BRU-61 rack with 4 GBU-39', cat: 'Guided bomb', kg: 4 * 129 + 145, L: 3.6, d: 0.4, shape: 'sdbrack', mat: 'white', guide: 'GPS / INS', range: 'over 110 km', origin: 'US', note: 'Four Small Diameter Bombs on one rack.' });

const STORE_CATS = ['Air-to-air', 'Air-to-surface', 'Anti-radiation', 'Anti-ship', 'Cruise missile', 'Air-launched ballistic', 'Guided bomb', 'Bomb', 'Cluster bomb', 'Nuclear', 'Fuel tank', 'Targeting pod', 'Sensor pod', 'Jamming pod'];

// ---- store meshes, built in store space: nose at x = 0, body along -x, axis at y = z = 0.
function fins(M, xRoot, chordR, chordT, rIn, rOut, sweep, mat, tf, tag, roll = Math.PI / 4, n = 4, t = 0.06) {
  for (let k = 0; k < n; k++) {
    const a = roll + (k / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const sec = (r, ch, off) => ({ le: [xRoot - off, ca * r, sa * r], te: [xRoot - off - ch, ca * r, sa * r], t });
    panel(M, [sec(rIn, chordR, 0), sec(rOut, chordT, (rOut - rIn) * Math.tan(sweep * D2R))], { mat, tf, tag });
  }
}

function storeMesh(M, st, tf, tag) {
  const L = st.L, r = st.d / 2, sp = (st.span || st.d * 1.4) / 2, mat = st.mat, seg = 10;
  const o = { seg, mat, tf, tag };
  switch (st.shape) {
    case 'aam': {
      loft(M, [[0, 0.01, 0.01, 0.01], [L * 0.04, r * 0.55, r * 0.55, r * 0.55], [L * 0.1, r * 0.92, r * 0.92, r * 0.92], [L * 0.16, r, r, r], [L * 0.97, r, r, r], [L, r * 0.8, r * 0.8, r * 0.8]],
        { ...o, mats: [st.glass ? 'seeker' : mat, st.glass ? 'seeker' : mat, 'band', mat, mat], capB: 'hole' });
      if (st.ramjet) for (const a of [0.8, 2.35]) loft(M, [[L * 0.45, 0.01, 0.01, 0.01], [L * 0.52, r * 0.35, r * 0.35, r * 0.35], [L * 0.9, r * 0.35, r * 0.35, r * 0.35]],
        { ...o, seg: 6, capF: 'hole', tf: (x, y, z) => tf(x, y + r * Math.cos(a), z + r * Math.sin(a)) });
      fins(M, -L * 0.86, L * 0.12, L * 0.06, r, sp, 35, mat, tf, tag, st.grid ? 0 : Math.PI / 4);
      if (st.wings) fins(M, -L * 0.3, L * 0.2, L * 0.04, r, Math.max(sp * 0.9, r * 2.2), 50, mat, tf, tag);
      if (st.canard) fins(M, -L * 0.1, L * 0.05, L * 0.03, r, r * 2.3, 30, mat, tf, tag);
      break;
    }
    case 'bomb': {
      loft(M, [[0, 0.01, 0.01, 0.01], [L * 0.06, r * 0.5, r * 0.5, r * 0.5], [L * 0.22, r * 0.93, r * 0.93, r * 0.93], [L * 0.45, r, r, r], [L * 0.62, r * 0.95, r * 0.95, r * 0.95], [L * 0.86, r * 0.45, r * 0.45, r * 0.45], [L, r * 0.35, r * 0.35, r * 0.35]],
        { ...o, mats: [mat, 'band', mat, mat, mat, mat] });
      fins(M, -L * 0.74, L * 0.24, L * 0.2, r * 0.45, sp, 5, mat, tf, tag);
      break;
    }
    case 'jdam': {
      loft(M, [[0, 0.01, 0.01, 0.01], [L * 0.06, r * 0.5, r * 0.5, r * 0.5], [L * 0.2, r * 0.93, r * 0.93, r * 0.93], [L * 0.42, r, r, r], [L * 0.6, r * 0.96, r * 0.96, r * 0.96], [L * 0.72, r * 0.72, r * 0.72, r * 0.72], [L * 0.98, r * 0.72, r * 0.72, r * 0.72], [L, r * 0.5, r * 0.5, r * 0.5]],
        { ...o, mats: [mat, 'band', mat, mat, mat, 'skin2', 'skin2'] });
      fins(M, -L * 0.8, L * 0.18, L * 0.14, r * 0.72, sp, 10, 'skin2', tf, tag);
      break;
    }
    case 'lgb': {
      loft(M, [[0, r * 0.3, r * 0.3, r * 0.3], [L * 0.1, r * 0.55, r * 0.55, r * 0.55], [L * 0.2, r * 0.6, r * 0.6, r * 0.6], [L * 0.28, r * 0.93, r * 0.93, r * 0.93], [L * 0.5, r, r, r], [L * 0.7, r * 0.95, r * 0.95, r * 0.95], [L * 0.85, r * 0.55, r * 0.55, r * 0.55], [L, r * 0.5, r * 0.5, r * 0.5]],
        { ...o, capF: 'seeker', mats: ['seeker', mat, mat, 'band', mat, mat, mat] });
      fins(M, -L * 0.12, L * 0.08, L * 0.04, r * 0.55, r * 1.6, 30, mat, tf, tag);
      fins(M, -L * 0.82, L * 0.16, L * 0.1, r * 0.5, sp, 25, mat, tf, tag);
      break;
    }
    case 'sdb': {
      loft(M, [[0, 0.01, 0.01, 0.01], [L * 0.12, r * 0.8, r * 0.8, r * 0.8], [L * 0.3, r, r, r], [L * 0.9, r, r, r], [L, r * 0.6, r * 0.6, r * 0.6]], { ...o, seg: 8, rot: Math.PI / 4 });
      fins(M, -L * 0.9, L * 0.1, L * 0.06, r, r * 1.7, 30, mat, tf, tag);
      break;
    }
    case 'sdbrack': {
      loft(M, [[0, 0.02, 0.05, 0.02], [0.3, 0.12, 0.1, 0.08], [L - 0.3, 0.12, 0.1, 0.08], [L, 0.02, 0.05, 0.02]], { ...o, mat: 'skin2', seg: 8 });
      const sd = STORES['GBU-39'];
      for (const [dx, dz] of [[0, -1], [0, 1], [-1.85, -1], [-1.85, 1]])
        storeMesh(M, sd, (x, y, z) => tf(x + dx - 0.02, y - 0.22, z + dz * 0.12), tag);
      break;
    }
    case 'tank': {
      loft(M, [[0, 0.01, 0.01, 0.01], [L * 0.08, r * 0.55, r * 0.55, r * 0.55], [L * 0.25, r * 0.95, r * 0.95, r * 0.95], [L * 0.45, r, r, r], [L * 0.7, r * 0.9, r * 0.9, r * 0.9], [L * 0.92, r * 0.4, r * 0.4, r * 0.4], [L, 0.02, 0.02, 0.02]], o);
      fins(M, -L * 0.8, L * 0.14, L * 0.08, r * 0.5, r * 1.1, 30, mat, tf, tag, 0, 3);
      break;
    }
    case 'pod': {
      loft(M, [[0, r * 0.7, r * 0.7, r * 0.7], [L * 0.05, r * 0.95, r * 0.95, r * 0.95], [L * 0.15, r, r, r], [L * 0.92, r, r, r], [L, r * 0.6, r * 0.6, r * 0.6]], { ...o, capF: 'seeker', mats: ['seeker', mat, mat, mat] });
      break;
    }
    case 'cruise': {
      const w = r, h = (st.h || st.d) / 2;
      loft(M, [[0, 0.02, 0.02, 0.02], [L * 0.05, w * 0.7, h * 0.6, h * 0.7], [L * 0.15, w, h, h], [L * 0.85, w, h, h], [L, w * 0.6, h * 0.5, h * 0.5]], { ...o, seg: 12, capF: mat });
      const k = [[-L * 0.85, h, 0], [-L * 0.85, -h * 0.2, w], [-L * 0.85, -h * 0.2, -w]];
      for (const [x, y, z] of k) {
        const up = z === 0, dz = up ? 0 : Math.sign(z) * sp * 0.7, dy = up ? sp * 0.6 : -sp * 0.2;
        panel(M, [{ le: [x, y, z], te: [x - L * 0.12, y, z], t: 0.07 }, { le: [x - L * 0.05, y + dy, z + dz], te: [x - L * 0.13, y + dy, z + dz], t: 0.07 }], { mat, tf, tag });
      }
      break;
    }
    case 'heavy': {
      loft(M, [[0, 0.01, 0.01, 0.01], [L * 0.1, r * 0.7, r * 0.7, r * 0.7], [L * 0.25, r, r, r], [L * 0.95, r, r, r], [L, r * 0.8, r * 0.8, r * 0.8]], { ...o, seg: 14, capB: 'hole' });
      fins(M, -L * 0.45, L * 0.35, L * 0.05, r, sp, 60, mat, tf, tag, 0, 2);
      fins(M, -L * 0.82, L * 0.16, L * 0.06, r, r + sp * 0.5, 45, mat, tf, tag, Math.PI / 2, 2);
      fins(M, -L * 0.82, L * 0.16, L * 0.06, r, r + sp * 0.35, 45, mat, tf, tag, -Math.PI / 2, 1);
      break;
    }
  }
}
