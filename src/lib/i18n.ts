export type Language = "en" | "gu" | "hi";

export interface Translations {
  // Brand & Nav
  brandTitle: string;
  brandSubtitle: string;
  navDiagnose: string;
  navSimulate: string;
  navActionPlan: string;
  navRegulator: string;
  navPortfolio: string;
  navCo2Exchange: string;
  navIntake: string;
  switchFactory: string;
  illustrativeData: string;
  selfReportedData: string;

  // Actions
  editLayout: string;

  // KPI Bar
  kpiAnnualCo2: string;
  kpiEnergyPerYear: string;
  kpiWastePerYear: string;
  kpiCircularityRatio: string;
  kpiHotspotsDetected: string;
  kpiRecoveredRatioSub: string;
  kpiAboveBenchmark: string;
  kpiWithinBenchmark: string;

  // Process List
  processBreakdown: string;
  processBreakdownSub: string;
  severityOnBenchmark: string;
  severityElevated: string;
  severityHotspot: string;

  // Hotspot Panel
  hotspotTitle: string;
  hotspotSub: string;
  selectProcessPrompt: string;
  rootCauseTitle: string;
  interventionsTitle: string;
  capex: string;
  annualSaving: string;
  co2Reduction: string;
  payback: string;
  months: string;
  years: string;
  tonnesPerYear: string;

  // Symbiosis
  symbiosisTitle: string;
  symbiosisSub: string;
  noInterventions: string;

  // Assistant (JARVIS)
  jarvisTitle: string;
  jarvisSub: string;
  jarvisGreeting: string;
  jarvisPrompt1: string;
  jarvisPrompt2: string;
  jarvisPrompt3: string;
  jarvisAskPlaceholder: string;
  jarvisButton: string;

  // Landing Page
  landingHeroBadge: string;
  landingHeroTitle1: string;
  landingHeroTitle2: string;
  landingHeroSubtitle: string;
  landingRunDiagnostic: string;
  landingTheMethod: string;
  landingPhaseOverview: string;
  landingPhaseDiagnose: string;
  landingPhaseSimulate: string;
  landingPhaseScale: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    brandTitle: "Circular Carbon Intelligence",
    brandSubtitle: "Gujarat Industrial Decarbonization Platform",
    navDiagnose: "Diagnose",
    navSimulate: "Simulate",
    navActionPlan: "Action plan",
    navRegulator: "Regulator",
    navPortfolio: "Portfolio",
    navCo2Exchange: "CO₂ Exchange",
    navIntake: "+ Intake",
    switchFactory: "Switch factory",
    illustrativeData: "Illustrative data",
    selfReportedData: "Self-reported",

    editLayout: "Edit layout & components",

    kpiAnnualCo2: "Annual CO2e",
    kpiEnergyPerYear: "Energy / yr",
    kpiWastePerYear: "Waste / yr",
    kpiCircularityRatio: "Circularity ratio",
    kpiHotspotsDetected: "Hotspots detected",
    kpiRecoveredRatioSub: "recovered / total material",
    kpiAboveBenchmark: "processes above benchmark",
    kpiWithinBenchmark: "all within benchmark",

    processBreakdown: "Process breakdown",
    processBreakdownSub: "Ranked by share of total emissions",
    severityOnBenchmark: "On benchmark",
    severityElevated: "Elevated",
    severityHotspot: "Hotspot",

    hotspotTitle: "Hotspot Diagnosis",
    hotspotSub: "Root-cause analysis and prioritized circular interventions",
    selectProcessPrompt: "Select a process from the 3D twin or the list to inspect root causes and recommended circular interventions.",
    rootCauseTitle: "Root Cause Analysis",
    interventionsTitle: "Recommended Circular Interventions",
    capex: "CAPEX",
    annualSaving: "Saving / yr",
    co2Reduction: "CO₂ Cut",
    payback: "Payback",
    months: "mo",
    years: "yr",
    tonnesPerYear: "t/yr",

    symbiosisTitle: "Industrial Symbiosis Matches",
    symbiosisSub: "Cross-factory by-product exchange opportunities within Gujarat clusters",
    noInterventions: "No interventions required for this component.",

    jarvisTitle: "JARVIS",
    jarvisSub: "Carbon intelligence assistant",
    jarvisGreeting: "Good day. I am JARVIS, your Carbon Intelligence assistant. Ask me anything about this prototype.",
    jarvisPrompt1: "What are the hotspots?",
    jarvisPrompt2: "Explain CO₂ Exchange",
    jarvisPrompt3: "How do I edit this factory?",
    jarvisAskPlaceholder: "Ask JARVIS…",
    jarvisButton: "Ask JARVIS",

    landingHeroBadge: "CIRCULAR CARBON ECOSYSTEM — DIAGNOSTIC ENGINE v2.1",
    landingHeroTitle1: "Stop Guessing.",
    landingHeroTitle2: "Start Pinpointing.",
    landingHeroSubtitle: "Instant digital twin, root cause analysis, and circular matchmaking for Gujarat's heavy industrial clusters.",
    landingRunDiagnostic: "RUN DIAGNOSTIC",
    landingTheMethod: "THE METHOD",
    landingPhaseOverview: "OVERVIEW",
    landingPhaseDiagnose: "DIAGNOSE",
    landingPhaseSimulate: "SIMULATE",
    landingPhaseScale: "SCALE",
  },

  gu: {
    brandTitle: "પરિપત્ર કાર્બન ઇન્ટેલિજન્સ",
    brandSubtitle: "ગુજરાત ઔદ્યોગિક ડીકાર્બોનાઇઝેશન પ્લેટફોર્મ",
    navDiagnose: "નિદાન",
    navSimulate: "સિમ્યુલેટ",
    navActionPlan: "એક્શન પ્લાન",
    navRegulator: "નિયમનકાર",
    navPortfolio: "પોર્ટફોલિયો",
    navCo2Exchange: "CO₂ એક્સચેન્જ",
    navIntake: "+ ઇન્ટેક",
    switchFactory: "ફેક્ટરી બદલો",
    illustrativeData: "સાંકેતિક ડેટા",
    selfReportedData: "સ્વ-અહેવાલ ડેટા",

    editLayout: "લેઆઉટ અને ઘટકો સંપાદિત કરો",

    kpiAnnualCo2: "વાર્ષિક CO2e",
    kpiEnergyPerYear: "વાર્ષિક ઊર્જા",
    kpiWastePerYear: "વાર્ષિક કચરો",
    kpiCircularityRatio: "પરિપત્રતા ગુણોત્તર",
    kpiHotspotsDetected: "શોધાયેલ હોટસ્પોટ્સ",
    kpiRecoveredRatioSub: "પુનઃપ્રાપ્ત / કુલ સામગ્રી",
    kpiAboveBenchmark: "બેન્ચમાર્ક કરતાં વધુ પ્રક્રિયાઓ",
    kpiWithinBenchmark: "બધી પ્રક્રિયાઓ બેન્ચમાર્કમાં છે",

    processBreakdown: "પ્રક્રિયા વિશ્લેષણ",
    processBreakdownSub: "કુલ ઉત્સર્જનમાં હિસ્સા મુજબ ક્રમાંકિત",
    severityOnBenchmark: "સામાન્ય (બેન્ચમાર્ક પર)",
    severityElevated: "વધારેલ",
    severityHotspot: "હોટસ્પોટ",

    hotspotTitle: "હોટસ્પોટ નિદાન",
    hotspotSub: "મૂળ કારણ વિશ્લેષણ અને પ્રાથમિકતાવાળા પરિપત્ર સુધારાઓ",
    selectProcessPrompt: "મૂળ કારણો અને ભલામણ કરેલ સુધારાઓ જોવા માટે 3D ટ્વિન અથવા સૂચિમાંથી પ્રક્રિયા પસંદ કરો.",
    rootCauseTitle: "મૂળ કારણ વિશ્લેષણ (Root Cause)",
    interventionsTitle: "ભલામણ કરેલ પરિપત્ર સુધારાઓ",
    capex: "મૂડી ખર્ચ (CAPEX)",
    annualSaving: "વાર્ષિક બચત",
    co2Reduction: "CO₂ ઘટાડો",
    payback: "પેબેક સમય",
    months: "મહિના",
    years: "વર્ષ",
    tonnesPerYear: "ટન/વર્ષ",

    symbiosisTitle: "ઔદ્યોગિક સહજીવન મેળ (Symbiosis)",
    symbiosisSub: "ગુજરાત ઔદ્યોગિક ક્લસ્ટરો વચ્ચે ઉપ-ઉત્પાદન વિનિમય તકો",
    noInterventions: "આ ઘટક માટે કોઈ સુધારાની જરૂર નથી.",

    jarvisTitle: "JARVIS",
    jarvisSub: "કાર્બન ઇન્ટેલિજન્સ સહાયક",
    jarvisGreeting: "નમસ્તે. હું જાર્વિસ (JARVIS) છું, તમારો કાર્બન ઇન્ટેલિજન્સ માર્ગદર્શક. ફેક્ટરી અથવા ઉત્સર્જન વિશે પૂછો.",
    jarvisPrompt1: "મુખ્ય હોટસ્પોટ્સ કયા છે?",
    jarvisPrompt2: "CO₂ એક્સચેન્જ કેવી રીતે કાર્ય કરે છે?",
    jarvisPrompt3: "આ ફેક્ટરી ડેટા કેવી રીતે બદલવો?",
    jarvisAskPlaceholder: "જાર્વિસને પૂછો…",
    jarvisButton: "પૂછો JARVIS",

    landingHeroBadge: "પરિપત્ર કાર્બન ઇકોસિસ્ટમ — નિદાન એન્જિન v2.1",
    landingHeroTitle1: "અનુમાન બંધ કરો.",
    landingHeroTitle2: "ચોક્કસ નિદાન શરૂ કરો.",
    landingHeroSubtitle: "ગુજરાતના ભારે ઔદ્યોગિક ક્લસ્ટરો માટે તાત્કાલિક ડિજિટલ ટ્વિન, મૂળ કારણ વિશ્લેષણ અને પરિપત્ર ભાગીદારી.",
    landingRunDiagnostic: "ડાયગ્નોસ્ટિક શરૂ કરો",
    landingTheMethod: "કાર્ય પદ્ધતિ",
    landingPhaseOverview: "વિહંગાવલોકન",
    landingPhaseDiagnose: "નિદાન",
    landingPhaseSimulate: "સિમ્યુલેટ",
    landingPhaseScale: "સ્કેલ (ગુજરાત)",
  },

  hi: {
    brandTitle: "चक्रीय कार्बन इंटेलिजेंस",
    brandSubtitle: "गुजरात औद्योगिक डीकार्बोनाइजेशन प्लेटफॉर्म",
    navDiagnose: "निदान",
    navSimulate: "सिमुलेट",
    navActionPlan: "कार्य योजना",
    navRegulator: "नियामक",
    navPortfolio: "पोर्टफोलियो",
    navCo2Exchange: "CO₂ एक्सचेंज",
    navIntake: "+ डेटा प्रविष्टि",
    switchFactory: "फैक्ट्री बदलें",
    illustrativeData: "सांकेतिक डेटा",
    selfReportedData: "स्व-रिपोर्टेड डेटा",

    editLayout: "लेआउट और घटक संपादित करें",

    kpiAnnualCo2: "वार्षिक CO2e",
    kpiEnergyPerYear: "वार्षिक ऊर्जा",
    kpiWastePerYear: "वार्षिक कचरा",
    kpiCircularityRatio: "चक्रीयता अनुपात",
    kpiHotspotsDetected: "पहचाने गए हॉटस्पॉट्स",
    kpiRecoveredRatioSub: "पुनर्प्राप्त / कुल सामग्री",
    kpiAboveBenchmark: "बेंचमार्क से अधिक प्रक्रियाएं",
    kpiWithinBenchmark: "सभी प्रक्रियाएं बेंचमार्क के भीतर",

    processBreakdown: "प्रक्रिया विवरण",
    processBreakdownSub: "कुल उत्सर्जन में हिस्सेदारी अनुसार क्रमबद्ध",
    severityOnBenchmark: "सामान्य (बेंचमार्क पर)",
    severityElevated: "बढ़ा हुआ",
    severityHotspot: "हॉटस्पॉट",

    hotspotTitle: "हॉटस्पॉट निदान",
    hotspotSub: "मूल कारण विश्लेषण और प्राथमिकता वाले चक्रीय उपाय",
    selectProcessPrompt: "मूल कारण और अनुशंसित चक्रीय उपाय देखने के लिए 3D ट्विन या सूची में से किसी प्रक्रिया का चयन करें।",
    rootCauseTitle: "मूल कारण विश्लेषण (Root Cause)",
    interventionsTitle: "अनुशंसित चक्रीय सुधार उपाय",
    capex: "पूंजीगत व्यय (CAPEX)",
    annualSaving: "वार्षिक बचत",
    co2Reduction: "CO₂ कटौती",
    payback: "पेबैक अवधि",
    months: "महीने",
    years: "वर्ष",
    tonnesPerYear: "टन/वर्ष",

    symbiosisTitle: "औद्योगिक सहजीविता (Symbiosis)",
    symbiosisSub: "गुजरात के औद्योगिक समूहों के बीच उप-उत्पाद विनिमय के अवसर",
    noInterventions: "इस घटक के लिए किसी सुधार की आवश्यकता नहीं है।",

    jarvisTitle: "JARVIS",
    jarvisSub: "कार्बन इंटेलिजेंस सहायक",
    jarvisGreeting: "नमस्ते. मैं जार्विस (JARVIS) हूँ, आपका कार्बन इंटेलिजेंस सहायक. मुझसे इस प्रोटोटाइप के बारे में कुछ भी पूछें।",
    jarvisPrompt1: "मुख्य हॉटस्पॉट्स कौन से हैं?",
    jarvisPrompt2: "CO₂ एक्सचेंज कैसे काम करता है?",
    jarvisPrompt3: "फैक्ट्री डेटा कैसे अपडेट करें?",
    jarvisAskPlaceholder: "जार्विस से पूछें…",
    jarvisButton: "जार्विस से पूछें",

    landingHeroBadge: "चक्रीय कार्बन इकोसिस्टम — निदान इंजन v2.1",
    landingHeroTitle1: "अनुमान लगाना बंद करें.",
    landingHeroTitle2: "सटीक निदान शुरू करें.",
    landingHeroSubtitle: "गुजरात के प्रमुख औद्योगिक क्लस्टरों के लिए तत्काल डिजिटल ट्विन, मूल कारण विश्लेषण और चक्रीय समाधान।",
    landingRunDiagnostic: "डायग्नोस्टिक चलाएं",
    landingTheMethod: "कार्यप्रणाली",
    landingPhaseOverview: "अवलोकन",
    landingPhaseDiagnose: "निदान",
    landingPhaseSimulate: "सिमुलेशन",
    landingPhaseScale: "विस्तार (गुजरात)",
  },
};

export const languageNames: Record<Language, { label: string; native: string; flag: string }> = {
  en: { label: "English", native: "English", flag: "EN" },
  gu: { label: "Gujarati", native: "ગુજરાતી", flag: "GU" },
  hi: { label: "Hindi", native: "हिन्दी", flag: "HI" },
};
