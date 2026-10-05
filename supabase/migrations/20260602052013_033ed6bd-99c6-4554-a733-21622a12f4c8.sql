
-- Seed daily anchors for missing traditions (7 each, matching christian/secular/stoic week)
INSERT INTO public.daily_anchors (anchor_date, tradition, theme, verse_ref, verse_text, reflection_prompt, breath_protocol) VALUES
-- Native / Indigenous: warrior culture, vision quest, body-is-sacred
('2026-05-18','native_indigenous','The body is sacred',NULL,'Mitakuye Oyasin — all my relations. Your body is borrowed earth; treat it as kin.','Where did you treat your body like a tool today instead of a gift? Name one act of respect you will give it tomorrow.','box'),
('2026-05-19','native_indigenous','Walk in beauty','Diné prayer','In beauty I walk. With beauty before me, behind me, above me, below me, I walk.','Walk outside, even ten steps. What in nature met you halfway today?','4-7-8'),
('2026-05-20','native_indigenous','The warrior''s discipline',NULL,'A warrior is not someone who fights; a warrior is someone who holds the line when no one is watching.','What line did you almost cross today? What kept you?','box'),
('2026-05-21','native_indigenous','Vision quest',NULL,'The elders say: a man who does not know where he is going will end up somewhere else.','Sit with this: who are you becoming? Write one sentence — your vision in plain words.','4-7-8'),
('2026-05-22','native_indigenous','Ancestors watching',NULL,'Your ancestors prayed for you. You are the answer. Live like it.','Which ancestor — by blood or by choice — would be proud of you today? Why?','box'),
('2026-05-23','native_indigenous','Earth medicine',NULL,'The earth does not belong to us; we belong to the earth. Eat from her. Sleep with her rhythms. Move on her ground.','One thing you ate or did today that disconnected you from the earth. One thing tomorrow that reconnects.','4-7-8'),
('2026-05-24','native_indigenous','Smoke and silence',NULL,'In silence the spirit speaks. In smoke the prayer rises. Sit. Breathe. Listen.','Five minutes of silence today. What did you hear underneath the noise?','box'),

-- Islamic: sabr, discipline, fasting reflection
('2026-05-18','islamic','Sabr — patient endurance','Qur''an 2:153','Indeed, Allah is with the patient.','Where did you lose patience today? What would sabr have looked like?','4-7-8'),
('2026-05-19','islamic','Nafs — the inner struggle','Hadith','The strong man is not the good wrestler; the strong man is he who controls himself when angry.','Name the part of your nafs that fought you today. What did you feed it?','box'),
('2026-05-20','islamic','Discipline of fasting',NULL,'Fasting is not only from food. Fast from idle words, from harsh judgments, from your phone.','Choose one thing to fast from for the next 24 hours. Write it.','4-7-8'),
('2026-05-21','islamic','Tawakkul — trust','Qur''an 65:3','Whoever places his trust in Allah, He is sufficient for him.','What outcome are you gripping too tightly? Loosen one finger today.','box'),
('2026-05-22','islamic','Dhikr — remembrance',NULL,'Hearts find rest in the remembrance of Allah. The body finds rest in stillness with Him.','Three breaths. With each exhale, one word of remembrance. What word did you choose?','4-7-8'),
('2026-05-23','islamic','Ihsan — excellence',NULL,'Worship Allah as if you see Him; if you do not see Him, He sees you.','What did you do today that you would not have done if you knew you were being watched? What would you do differently?','box'),
('2026-05-24','islamic','Shukr — gratitude','Qur''an 14:7','If you are grateful, I will surely increase you.','List three things — small, ordinary — that you took for granted today.','4-7-8'),

-- Catholic: saints, Lent-style 40-day rebuild
('2026-05-18','catholic','Take up your cross','Luke 9:23','If anyone would come after Me, let him deny himself and take up his cross daily and follow Me.','What small cross did you refuse to carry today? Pick it up tomorrow without complaint.','4-7-8'),
('2026-05-19','catholic','St. Augustine on restless hearts','Confessions','Our hearts are restless, O Lord, until they rest in Thee.','Where did you go looking for rest today that could not give it?','box'),
('2026-05-20','catholic','Fiat — let it be done','Luke 1:38','Behold, I am the handmaid of the Lord; let it be done to me according to Thy word.','What is God asking of you that you are still negotiating? Say your fiat.','4-7-8'),
('2026-05-21','catholic','St. Therese — the little way',NULL,'Do small things with great love.','One small, hidden act of love today. What was it? If none — what will it be tomorrow?','box'),
('2026-05-22','catholic','Examen of conscience','St. Ignatius','Review the day with God. Where did grace meet you? Where did you turn from it?','Three gratitudes. One failure. One amendment for tomorrow.','4-7-8'),
('2026-05-23','catholic','The 40 days','Matthew 4:1-2','Jesus was led by the Spirit into the wilderness, fasting forty days and forty nights.','Your rebuild is a wilderness. What temptation met you today? What did you answer it with?','box'),
('2026-05-24','catholic','Eucharistic stillness',NULL,'Come to Me, all you who labor and are heavy laden, and I will give you rest.','Five minutes of silence in His presence. No asking. Just being seen.','4-7-8'),

-- Jewish: teshuvah, mussar
('2026-05-18','jewish','Teshuvah — return','Hosea 14:2','Return, O Israel, to the Lord your God.','Where did you stray from the man you intend to be today? Take one step back toward him.','4-7-8'),
('2026-05-19','jewish','Tikkun olam — repair',NULL,'You are not obligated to complete the work, but neither are you free to abandon it. — Pirkei Avot 2:21','What one small repair — to your body, your home, a relationship — will you make today?','box'),
('2026-05-20','jewish','Mussar — character work',NULL,'The first step to greatness is humility. Know what you lack before you build.','Name one middah (trait) you are weak in. Patience? Discipline? Generosity? Work it today.','4-7-8'),
('2026-05-21','jewish','Shabbat within',NULL,'More than Israel has kept the Sabbath, the Sabbath has kept Israel. — Ahad Ha''am','Take twenty minutes of true rest today. No screen. No striving. Just being.','box'),
('2026-05-22','jewish','Hineni — here I am','Genesis 22:1','And God called to Abraham, and he said: Hineni — here I am.','When called today — by a child, a friend, your own conscience — were you fully here?','4-7-8'),
('2026-05-23','jewish','Kavanah — intention',NULL,'A mitzvah without kavanah is a body without a soul.','What action did you go through the motions of today? How would you do it with full intention tomorrow?','box'),
('2026-05-24','jewish','Gam zu l''tovah','Rabbi Nachum','This too is for the good.','What setback today might be the seed of something you will thank later?','4-7-8'),

-- Hindu: dharma, tapas
('2026-05-18','hindu','Dharma — your sacred duty','Bhagavad Gita 3:35','Better to do your own dharma imperfectly than another''s perfectly.','What is yours to do today that only you can do? Stop borrowing other people''s lives.','4-7-8'),
('2026-05-19','hindu','Tapas — disciplined fire','Bhagavad Gita 17:14-16','Austerity of body, speech, and mind — practiced with faith and no expectation of reward — is the highest tapas.','Choose one austerity today: a missed meal, an unspoken word, a quieted mind. Which?','box'),
('2026-05-20','hindu','The witness self','Upanishads','You are not the body. You are not the mind. You are the witness of both.','When emotion rose today, did you become it, or watch it? Practice watching one wave tomorrow.','4-7-8'),
('2026-05-21','hindu','Karma yoga — action without attachment','Bhagavad Gita 2:47','You have a right to your actions, but never to the fruits.','What outcome are you working for that is robbing you of the work itself? Release it.','box'),
('2026-05-22','hindu','Ahimsa — nonviolence',NULL,'Nonviolence first to the self — the words you speak inwardly, the food you choose, the way you push your body.','One way you were violent to yourself today. One ahimsa-act for tomorrow.','4-7-8'),
('2026-05-23','hindu','Pranayama — breath as bridge',NULL,'Breath is the bridge between body and spirit. Master it, and you master both.','Four rounds of slow nasal breathing. Note: how did your mind shift?','box'),
('2026-05-24','hindu','Satya — truth','Yoga Sutras 2:36','When truth is established, all actions bear fruit.','One half-truth you told today — to yourself or another. Speak it true tomorrow.','4-7-8'),

-- Buddhist: equanimity, right effort
('2026-05-18','buddhist','Right effort','Dhammapada 80','As irrigators direct water, as fletchers shape arrows, as carpenters bend wood — the wise shape themselves.','Where did you let yourself drift today? What is one place you will apply right effort tomorrow?','4-7-8'),
('2026-05-19','buddhist','Equanimity — upekkha',NULL,'May I be a friend to those who are joyful, those who are suffering, and those who are indifferent.','When something shook you today, did you stay? Or did you grasp / push away?','box'),
('2026-05-20','buddhist','The middle way',NULL,'Not too tight. Not too loose. The string sings only when tuned with care.','Are you over-pushing or under-doing in your rebuild right now? Where is the middle?','4-7-8'),
('2026-05-21','buddhist','Beginner''s mind','Shunryu Suzuki','In the beginner''s mind there are many possibilities; in the expert''s mind there are few.','Approach one familiar thing today as if for the first time. Eating. Walking. Listening.','box'),
('2026-05-22','buddhist','Anicca — impermanence','Dhammapada','All conditioned things are impermanent. Work out your liberation with diligence.','Name something heavy you''re carrying. Now remember: it too will pass. Does the grip loosen?','4-7-8'),
('2026-05-23','buddhist','Metta — loving-kindness',NULL,'May I be happy. May I be safe. May I be free from suffering.','Send those four lines to yourself today. Then to someone you find difficult. Notice what happens.','box'),
('2026-05-24','buddhist','Mindfulness of the body','Satipatthana Sutta','Walking, the monk knows: I am walking. Sitting, he knows: I am sitting.','One activity today done with full attention to the body. What did you notice that you usually miss?','4-7-8');

-- Wearables waitlist
CREATE TABLE public.wearables_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  provider text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT ON public.wearables_waitlist TO authenticated;
GRANT ALL ON public.wearables_waitlist TO service_role;

ALTER TABLE public.wearables_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own wearables waitlist row"
  ON public.wearables_waitlist FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own wearables waitlist row"
  ON public.wearables_waitlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
