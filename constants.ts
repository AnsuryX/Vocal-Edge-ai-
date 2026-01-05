import { Language, ScenarioType, Scenario, Persona } from './types';

export const FOCUS_SKILLS = [
  { id: 'active_listening', label: { en: 'Active Listening', ar_msa: 'الاستماع النشط', ar_khaleeji: 'تسمع زين' } },
  { id: 'assertiveness', label: { en: 'Assertiveness', ar_msa: 'الحزم', ar_khaleeji: 'قوة الشخصية' } },
  { id: 'clarity', label: { en: 'Clarity', ar_msa: 'الوضوح', ar_khaleeji: 'وضوح الكلام' } },
  { id: 'persuasion', label: { en: 'Persuasion', ar_msa: 'الإقناع', ar_khaleeji: 'القدرة على الإقناع' } },
  { id: 'empathy', label: { en: 'Empathy', ar_msa: 'التعاطف', ar_khaleeji: 'التعاطف' } },
  { id: 'vulnerability', label: { en: 'Vulnerability', ar_msa: 'الصدق الشعوري', ar_khaleeji: 'الفضفضة' } }
];

export const SCENARIOS: Scenario[] = [
  {
    id: '4',
    type: ScenarioType.CONFIDENCE,
    title: { en: 'Confidence Booster', ar_msa: 'بناء الثقة', ar_khaleeji: 'فضفض وارتكي' },
    description: { en: 'A safe space to share and open up.', ar_msa: 'مساحة آمنة للمشاركة والانفتاح.', ar_khaleeji: 'مكان آمن للسوالف والفضفضة.' },
    icon: 'fa-heart',
    personas: [
      {
        id: 'c1',
        name: { en: 'Maya', ar_msa: 'مايا', ar_khaleeji: 'مايا' },
        role: { en: 'The Supportive Friend', ar_msa: 'الصديقة الداعمة', ar_khaleeji: 'رفيقتك اللي تسمعك' },
        personality: { en: 'Empathetic, non-judgmental, and genuinely curious. Maya believes in you and wants to help you express your true self.', ar_msa: 'متعاطفة، غير مصدرة للأحكام، وفضولية بصدق. مايا تؤمن بك وتريد مساعدتك على التعبير عن نفسك الحقيقية.', ar_khaleeji: 'طيبة حيل، تسمعك بقلبها، وتبيك تطلع اللي في خاطرك بكل راحة.' },
        icon: 'fa-sun',
        isWarm: true
      },
      {
        id: 'c2',
        name: { en: 'Leo', ar_msa: 'ليث', ar_khaleeji: 'بو عبدالله' },
        role: { en: 'Gentle Encourager', ar_msa: 'المشجع اللطيف', ar_khaleeji: 'أخوك العود اللي ينصح' },
        personality: { en: 'Warm and patient. Leo asks deep "why" questions to help you reflect without pressure.', ar_msa: 'دافئ وصبور. ليث يطرح أسئلة "لماذا" عميقة لمساعدتك على التأمل دون ضغط.', ar_khaleeji: 'صبور ووسيع صدر، يسألك "ليش" و "شلون" عشان يساعدك تفهم نفسك أكثر.' },
        icon: 'fa-mug-hot',
        isWarm: true
      }
    ]
  },
  {
    id: '1',
    type: ScenarioType.SALES,
    title: { en: 'Sales Pitch', ar_msa: 'عرض بيع', ar_khaleeji: 'عرض بيع' },
    description: { en: 'Master the art of closing deals.', ar_msa: 'إتقان فن إبرام الصفقات.', ar_khaleeji: 'تعلم شلون تخلص البيعة.' },
    icon: 'fa-chart-line',
    personas: [
      {
        id: 's1',
        name: { en: 'Mr. Budget', ar_msa: 'السيد ميزانية', ar_khaleeji: 'بو ميزانية' },
        role: { en: 'Cheapskate CEO', ar_msa: 'مدير تنفيذي مقتصد', ar_khaleeji: 'مدير بخيل شوي' },
        personality: { en: 'Only cares about ROI and discounts. Brutally hates hidden costs.', ar_msa: 'يهتم فقط بالعائد على الاستثمار والخصومات.', ar_khaleeji: 'ما يهمه إلا الفلوس والخصم.' },
        icon: 'fa-wallet'
      },
      {
        id: 's2',
        name: { en: 'Tech Tina', ar_msa: 'تينا التقنية', ar_khaleeji: 'تينا التقنية' },
        role: { en: 'Engineering Lead', ar_msa: 'رئيسة المهندسين', ar_khaleeji: 'مسؤولة التقنية' },
        personality: { en: 'Focused on specs and logic. Dismisses marketing fluff immediately.', ar_msa: 'تركز على المواصفات والمنطق. ترفض الهراء التسويقي.', ar_khaleeji: 'تحب التفاصيل التقنية وما تحب اللف والدوران.' },
        icon: 'fa-microchip'
      }
    ]
  },
  {
    id: '2',
    type: ScenarioType.NORMAL,
    title: { en: 'Everyday Dialogue', ar_msa: 'حوار يومي', ar_khaleeji: 'سوالف عادية' },
    description: { en: 'Build social confidence.', ar_msa: 'بناء الثقة الاجتماعية.', ar_khaleeji: 'قو قلبك بالسوالف.' },
    icon: 'fa-comments',
    personas: [
      {
        id: 'n1',
        name: { en: 'Awkward Ahmed', ar_msa: 'أحمد المحرج', ar_khaleeji: 'أحمد المنحرج' },
        role: { en: 'Socially Anxious Neighbor', ar_msa: 'جار قلق اجتماعياً', ar_khaleeji: 'جارنا اللي يستحي' },
        personality: { en: 'Short answers, avoids eye contact, easily weirded out.', ar_msa: 'إجابات قصيرة، يتجنب التواصل البصري.', ar_khaleeji: 'كلامه قليل وما يحب السوالف الوايد.' },
        icon: 'fa-user-ninja'
      },
      {
        id: 'n3',
        name: { en: 'Cold Sarah', ar_msa: 'سارة الباردة', ar_khaleeji: 'سارة الباردة' },
        role: { en: 'Professional Colleague', ar_msa: 'زميلة عمل مهنية', ar_khaleeji: 'زميلة الدوام الرسمية' },
        personality: { en: 'Strictly professional, zero small talk. Judges your competence.', ar_msa: 'مهنية بصرامة، لا كلام جانبي. تحكم على كفاءتك.', ar_khaleeji: 'رسمية حيل وما عندها وقت للمجاملات.' },
        icon: 'fa-user-tie'
      }
    ]
  },
  {
    id: '3',
    type: ScenarioType.DEBATE,
    title: { en: 'Heated Debate', ar_msa: 'مناظرة حادة', ar_khaleeji: 'هوشة محترمة' },
    description: { en: 'Stay calm under pressure.', ar_msa: 'ابق هادئاً تحت الضغط.', ar_khaleeji: 'خلك هادي وقت النقاش.' },
    icon: 'fa-fire',
    personas: [
      {
        id: 'd1',
        name: { en: 'Logic Larry', ar_msa: 'لبيب المنطقي', ar_khaleeji: 'لبيب الفاهم' },
        role: { en: 'The Fact-Checker', ar_msa: 'مدقق الحقائق', ar_khaleeji: 'اللي يصيد الأخطاء' },
        personality: { en: 'Calmly dismantling your arguments with data and logic.', ar_msa: 'تفكيك حججك بهدوء باستخدام البيانات والمنطق.', ar_khaleeji: 'يفكك كلامك حبة حبة بالمنطق.' },
        icon: 'fa-balance-scale'
      },
      {
        id: 'd2',
        name: { en: 'Angry Alex', ar_msa: 'عصام الغاضب', ar_khaleeji: 'بو جاسم المعصب' },
        role: { en: 'Aggressive Skeptic', ar_msa: 'متشكك عدواني', ar_khaleeji: 'معصب وما يقتنع' },
        personality: { en: 'Uses emotional attacks and constant interruptions.', ar_msa: 'يستخدم الهجمات العاطفية والمقاطعة المستمرة.', ar_khaleeji: 'يصارخ ويقاطعك عشان يضيعك.' },
        icon: 'fa-angry'
      },
      {
        id: 'd3',
        name: { en: 'Emotional Emma', ar_msa: 'إيمان العاطفية', ar_khaleeji: 'إيمان اللي تشخصن' },
        role: { en: 'The Passionate Advocate', ar_msa: 'المدافعة العاطفية', ar_khaleeji: 'اللي تدخل المشاعر بكل شي' },
        personality: { en: 'Extremely emotional and quick to take things personally. She uses logical fallacies and personal jabs to distract from the facts. Her goal is to frustrate you into losing your cool.', ar_msa: 'عاطفية للغاية وسريعة في أخذ الأمور على محمل شخصي. تستخدم المغالطات المنطقية والطعن الشخصي لصرف الانتباه عن الحقائق.', ar_khaleeji: 'تشخصن كل شي وتهاجمك شخصياً إذا ما لقت رد، تبيك تعصب وتضيع علومك.' },
        icon: 'fa-face-tired'
      },
      {
        id: 'd4',
        name: { en: 'Static Steve', ar_msa: 'ثابت الصامت', ar_khaleeji: 'ستيف الجامد' },
        role: { en: 'The Living Encyclopedia', ar_msa: 'الموسوعة الحية', ar_khaleeji: 'قاموس يمشي' },
        personality: { en: 'Zero emotional response. He communicates only in facts, statistics, and peer-reviewed logic. He will calmly point out every single factual error you make without ever raising his voice.', ar_msa: 'لا يوجد رد فعل عاطفي. يتواصل فقط من خلال الحقائق والإحصائيات والمنطق الموثق. سيشير بهدوء إلى كل خطأ حقيقي ترتكبه دون رفع صوته أبداً.', ar_khaleeji: 'جامد وما يبتسم، كلامه كله أرقام وإثباتات. يصيد عليك أي زلة بالمنطق والهدوء.' },
        icon: 'fa-robot'
      },
      {
        id: 'd5',
        name: { en: 'Wade "The Roast" Wilson', ar_msa: 'ويد المستهزئ', ar_khaleeji: 'ويد اللي يطنز' },
        role: { en: 'The Mercenary of Mockery', ar_msa: 'مرتزق السخرية', ar_khaleeji: 'راعي طنازة وقصف جبهات' },
        personality: { en: 'Extremely funny, sarcastic, and roasty. He talks like Deadpool—breaking the fourth wall, making pop-culture references, and using witty insults to derail your argument. He tests your ability to stay serious while being mercilessly mocked.', ar_msa: 'مضحك للغاية، ساخر، ولا يرحم في استهزائه. يتحدث مثل ديدبول - يكسر الجدار الرابع، ويستخدم مراجع الثقافة الشعبية، والإهانات الذكية لإخراج حجتك عن مسارها.', ar_khaleeji: 'لسانه طويل ويحب الطنازة، كلامه كله نكت وقصف جبهات. يبيك تضحك أو تعصب عشان تنسى موضوعك الأساسي.' },
        icon: 'fa-masks-theater'
      }
    ]
  }
];

export const TRANSLATIONS = {
  welcome: { en: 'Welcome back', ar_msa: 'مرحباً بعودتك', ar_khaleeji: 'هلا بك من جديد' },
  practiceNow: { en: 'Practice Now', ar_msa: 'تدرب الآن', ar_khaleeji: 'تدرب الحين' },
  history: { en: 'Performance Timeline', ar_msa: 'تاريخ الأداء', ar_khaleeji: 'سجل إنجازاتك' },
  startSession: { en: 'Start Session', ar_msa: 'بدء الجلسة', ar_khaleeji: 'ابدأ الجلسة' },
  endSession: { en: 'Finish', ar_msa: 'إنهاء', ar_khaleeji: 'خلصنا' },
  analyzing: { en: 'Analyzing Performance...', ar_msa: 'تحليل الأداء...', ar_khaleeji: 'قاعدين نحلل...' },
  feedbackTitle: { en: 'The Truth', ar_msa: 'النتيجة', ar_khaleeji: 'الزبدة' },
  confidence: { en: 'Confidence', ar_msa: 'الثقة', ar_khaleeji: 'الثقة بالنفس' },
  effectiveness: { en: 'Effectiveness', ar_msa: 'الفعالية', ar_khaleeji: 'التأثير' },
  customize: { en: 'Customize Scenario', ar_msa: 'تخصيص السيناريو', ar_khaleeji: 'فصل الجلسة على كيفك' },
  topicPlaceholder: { en: 'What are we talking about?', ar_msa: 'عن ماذا سنتحدث؟', ar_khaleeji: 'عن شو بتسولف؟' },
  outcomePlaceholder: { en: 'What is your goal?', ar_msa: 'ما هو هدفك؟', ar_khaleeji: 'شو تبي توصل له؟' },
  selectPersona: { en: 'Select Your Opponent', ar_msa: 'اختر خصمك', ar_khaleeji: 'اختر اللي تبي تجابله' },
  focusSkills: { en: 'Focus Skills', ar_msa: 'مهارات التركيز', ar_khaleeji: 'المهارات اللي تبي تطورها' },
  pronunciationTitle: { en: 'Pronunciation Workshop', ar_msa: 'ورشة النطق', ar_khaleeji: 'عدّل لسانك' },
  listen: { en: 'Listen', ar_msa: 'استمع', ar_khaleeji: 'اسمع' },
  record: { en: 'Record', ar_msa: 'سجل', ar_khaleeji: 'سجل صوتك' },
  stop: { en: 'Stop', ar_msa: 'توقف', ar_khaleeji: 'وقف' },
  excellent: { en: 'Excellent!', ar_msa: 'ممتاز!', ar_khaleeji: 'وحش!' },
  tryAgain: { en: 'Try Again', ar_msa: 'حاول مرة أخرى', ar_khaleeji: 'جرب مرة ثانية' },
  reviewRecording: { en: 'Review Recording', ar_msa: 'مراجعة التسجيل', ar_khaleeji: 'اسمع الجلسة' },
  recordingTurns: { en: 'Conversation Timeline', ar_msa: 'الجدول الزمني للحوار', ar_khaleeji: 'تسلسل السوالف' },
  suggestedTopics: { en: 'Suggested Topics', ar_msa: 'مواضيع مقترحة', ar_khaleeji: 'مواضيع للسوالف' },
  generatingTopics: { en: 'Seeking inspiration...', ar_msa: 'البحث عن إلهام...', ar_khaleeji: 'قاعدين ندور مواضيع...' },
  profile: { en: 'User Account', ar_msa: 'حساب المستخدم', ar_khaleeji: 'بياناتي الشخصية' },
  stats: { en: 'Skill Metrics', ar_msa: 'مقاييس المهارة', ar_khaleeji: 'إحصائياتي' },
  statsSessions: { en: 'Total Sessions', ar_msa: 'إجمالي الجلسات', ar_khaleeji: 'كم مرة تدربت' },
  statsAvg: { en: 'Avg. Score', ar_msa: 'متوسط الدرجة', ar_khaleeji: 'معدلك' },
  statsBestSkill: { en: 'Dominant Skill', ar_msa: 'المهارة السائدة', ar_khaleeji: 'أقوى مهارة' },
  settingsResetKey: { en: 'Switch Billing Project', ar_msa: 'تغيير مشروع الفوترة', ar_khaleeji: 'تغيير مفتاح التشغيل' },
  settingsClearData: { en: 'Wipe History', ar_msa: 'مسح السجل بالكامل', ar_khaleeji: 'امسح كل شي' },
  noHistory: { en: 'No sessions recorded yet.', ar_msa: 'لم يتم تسجيل أي جلسات بعد.', ar_khaleeji: 'للحين ما سويت ولا جلسة.' },
  saveProfile: { en: 'Save Details', ar_msa: 'حفظ البيانات', ar_khaleeji: 'حفظ' },
  userName: { en: 'Display Name', ar_msa: 'الاسم المعروض', ar_khaleeji: 'اسمك' },
  userBio: { en: 'Professional Bio / Role', ar_msa: 'نبذة شخصية', ar_khaleeji: 'عن نفسك' },
  userGoal: { en: 'Primary Goal', ar_msa: 'الهدف الأساسي', ar_khaleeji: 'هدفك الحين' },
  toneVibe: { en: 'Coach Tone Vibe', ar_msa: 'نبرة المدرب المفضلة', ar_khaleeji: 'جو المدرب اللي تحبه' },
  // Tutorial Strings
  tutorialWelcome: { en: 'Mission Briefing', ar_msa: 'موجز المهمة', ar_khaleeji: 'خطة التدريب' },
  tutorialHome: { en: 'Choose your combat zone. Each scenario tests a different set of communication skills.', ar_msa: 'اختر منطقة القتال الخاصة بك. كل سيناريو يختبر مهارات مختلفة.', ar_khaleeji: 'اختر الميدان اللي تبي تجربه. كل سيناريو يختبر مهارات معينة.' },
  tutorialCustomize: { en: 'Customize the mission. Set the topic and pick an opponent that will push your limits.', ar_msa: 'خصص المهمة. حدد الموضوع واختر خصماً سيدفعك إلى أقصى حدودك.', ar_khaleeji: 'فصل المهمة على كيفك. حدد الموضوع واختار اللي تبي تجابله.' },
  tutorialPractice: { en: 'Speak naturally. We analyze your tone, energy, and pace in real-time.', ar_msa: 'تحدث بشكل طبيعي. نقوم بتحليل نبرة صوتك وطاقتك في الوقت الفعلي.', ar_khaleeji: 'سولف عادي. بنحلل نبرة صوتك وطاقتك وسرعتك في نفس الوقت.' },
  tutorialResults: { en: 'Receive the unfiltered truth. Review your metrics and master the feedback.', ar_msa: 'احصل على الحقيقة غير المفلترة. راجع مقاييسك وأتقن الملاحظات.', ar_khaleeji: 'خذ الزبدة بدون مجاملات. راجع أرقامك وتعلم من الملاحظات.' },
  tutorialNext: { en: 'Next', ar_msa: 'التالي', ar_khaleeji: 'اللي بعده' },
  tutorialFinish: { en: 'Ready to Engage', ar_msa: 'جاهز للاشتباك', ar_khaleeji: 'جاهز للسوالف' }
};