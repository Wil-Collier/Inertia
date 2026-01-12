// Exercise instructions and YouTube video references for all default exercises
// YouTube IDs are from popular fitness channels with good form demonstrations

export interface ExerciseInstruction {
  instructions: string[]
  tips: string[]
  youtubeId?: string
}

export const exerciseInstructions: Record<string, ExerciseInstruction> = {
  // Chest (default-1 to default-7)
  "default-1": {
    // Bench Press
    instructions: [
      "Lie flat on the bench with feet planted firmly on the floor",
      "Grip the bar slightly wider than shoulder-width apart",
      "Unrack the bar and position it directly over your chest",
      "Lower the bar to mid-chest level with control",
      "Press the bar back up explosively until arms are fully extended",
    ],
    tips: [
      "Keep shoulder blades retracted and squeezed together throughout",
      "Maintain a slight arch in your lower back",
      "Drive through your legs for stability",
      "Don't bounce the bar off your chest",
    ],
    youtubeId: "4Y2ZdHCOXok", // Jeff Nippard
  },
  "default-2": {
    // Incline Bench Press
    instructions: [
      "Set the bench to a 30-45 degree incline angle",
      "Lie back with feet flat on the floor",
      "Grip the bar slightly wider than shoulder-width",
      "Lower the bar to your upper chest, just below the collarbone",
      "Press up and slightly back to lockout",
    ],
    tips: [
      "The incline angle targets the upper chest more",
      "Don't flare elbows out too wide - aim for 45-75 degrees",
      "Keep your back against the bench throughout",
    ],
    youtubeId: "SrqOu55lrYU", // Jeff Nippard
  },
  "default-3": {
    // Incline Dumbbell Press
    instructions: [
      "Set bench to 30-45 degree incline",
      "Hold dumbbells at shoulder level with palms facing forward",
      "Press dumbbells up and together, without clanking them",
      "Lower with control to chest level",
      "Keep a slight arc in the movement path",
    ],
    tips: [
      "Dumbbells allow for greater range of motion than barbell",
      "Rotate palms slightly inward at the top for peak contraction",
      "Don't let dumbbells drift too far apart at the bottom",
    ],
    youtubeId: "8iPEnn-ltC8", // ScottHermanFitness
  },
  "default-4": {
    // Dumbbell Flyes
    instructions: [
      "Lie flat on bench holding dumbbells above chest, palms facing each other",
      "Keep a slight bend in your elbows throughout",
      "Lower the weights in a wide arc until you feel a stretch in your chest",
      "Squeeze your chest to bring the weights back together",
      "Imagine hugging a large tree",
    ],
    tips: [
      "Don't go too heavy - this is an isolation exercise",
      "Focus on the stretch and squeeze, not the weight",
      "Keep the movement controlled, especially on the way down",
    ],
    youtubeId: "eozdVDA78K0", // ScottHermanFitness
  },
  "default-5": {
    // Push-ups
    instructions: [
      "Start in a high plank position with hands slightly wider than shoulder-width",
      "Keep your body in a straight line from head to heels",
      "Lower your chest to just above the ground",
      "Push back up to the starting position",
      "Keep your core tight throughout the movement",
    ],
    tips: [
      "Don't let your hips sag or pike up",
      "Look slightly ahead, not straight down",
      "For easier variation, do them on your knees",
      "For harder variation, elevate your feet",
    ],
    youtubeId: "IODxDxX7oi4", // Calisthenicmovement
  },
  "default-6": {
    // Cable Crossover
    instructions: [
      "Set the pulleys to the highest position",
      "Stand in the center of the cable station, one foot slightly forward",
      "Grab both handles and step forward for tension",
      "With a slight bend in elbows, bring hands together in front of your chest",
      "Squeeze your chest at the bottom, then return with control",
    ],
    tips: [
      "Lean slightly forward from the hips",
      "Keep constant tension on the cables",
      "Try different pulley heights to target different areas of chest",
    ],
    youtubeId: "taI4XduLpTk", // ScottHermanFitness
  },
  "default-7": {
    // Pec Deck
    instructions: [
      "Adjust the seat so handles are at chest height",
      "Sit with your back flat against the pad",
      "Place forearms against the pads, elbows at 90 degrees",
      "Bring the pads together in front of your chest",
      "Squeeze at the peak, then return with control",
    ],
    tips: [
      "Don't let the weights touch at the bottom - maintain tension",
      "Focus on squeezing your chest, not pushing with your arms",
      "Keep your back against the pad throughout",
    ],
    youtubeId: "Z57CtFmRMxA", // ScottHermanFitness
  },

  // Back (default-8 to default-13)
  "default-8": {
    // Deadlift
    instructions: [
      "Stand with feet hip-width apart, bar over mid-foot",
      "Bend at hips and knees, grip the bar just outside your legs",
      "Keep your back flat and chest up",
      "Drive through your heels, extending hips and knees simultaneously",
      "Stand fully upright, then reverse the movement to lower the bar",
    ],
    tips: [
      "Keep the bar close to your body throughout",
      "Engage your lats by 'bending the bar' around your shins",
      "Don't round your lower back",
      "Think of pushing the floor away, not pulling the bar up",
    ],
    youtubeId: "op9kVnSso6Q", // Alan Thrall
  },
  "default-9": {
    // Pull-ups
    instructions: [
      "Hang from a bar with hands shoulder-width apart or slightly wider",
      "Engage your core and pull your shoulder blades down and back",
      "Pull yourself up until your chin is over the bar",
      "Lower yourself with control back to a dead hang",
      "Avoid swinging or kipping",
    ],
    tips: [
      "If you can't do a full pull-up, use resistance bands for assistance",
      "Focus on pulling with your back, not your biceps",
      "Try different grip widths to target different muscles",
    ],
    youtubeId: "eGo4IYlbE5g", // Jeff Nippard
  },
  "default-10": {
    // Weighted Pull-ups
    instructions: [
      "Attach weight using a dip belt, weighted vest, or dumbbell between feet",
      "Perform a pull-up with the same technique as bodyweight",
      "Control the descent even more carefully with added weight",
      "Start with small weight increments (5-10 lbs)",
    ],
    tips: [
      "Master bodyweight pull-ups before adding weight",
      "Focus on quality over quantity with added weight",
      "A dip belt is the most secure way to add weight",
    ],
    youtubeId: "vw5A_IA1O-Y", // Calisthenicmovement
  },
  "default-11": {
    // Barbell Row
    instructions: [
      "Stand with feet shoulder-width apart, slight bend in knees",
      "Hinge at hips until torso is nearly parallel to the floor",
      "Grip bar slightly wider than shoulder-width",
      "Pull the bar to your lower chest/upper abdomen",
      "Lower with control and repeat",
    ],
    tips: [
      "Keep your back flat throughout - don't round",
      "Pull your elbows back, not just up",
      "Squeeze your shoulder blades together at the top",
      "Don't use momentum - control the weight",
    ],
    youtubeId: "FWJR5Ve8bnQ", // Alan Thrall
  },
  "default-12": {
    // Lat Pulldown
    instructions: [
      "Sit at the machine with thighs secured under the pads",
      "Grip the bar wider than shoulder-width with palms facing away",
      "Pull the bar down to your upper chest",
      "Squeeze your lats at the bottom, then return with control",
      "Keep your torso upright or lean back slightly",
    ],
    tips: [
      "Don't lean too far back - this turns it into a row",
      "Pull your elbows down and back, not just down",
      "Don't grip too tight - let your lats do the work",
    ],
    youtubeId: "CAwf7n6Luuc", // Jeff Nippard
  },
  "default-13": {
    // Seated Cable Row
    instructions: [
      "Sit at the cable row machine with feet on the footrests",
      "Grab the handle with arms extended, slight knee bend",
      "Pull the handle to your abdomen while keeping your back straight",
      "Squeeze your shoulder blades together at the end",
      "Return to start with control, don't let the weight pull you forward",
    ],
    tips: [
      "Don't lean back excessively - keep your torso stable",
      "Focus on retracting your shoulder blades",
      "Try different attachments for variety (V-bar, wide bar, rope)",
    ],
    youtubeId: "GZbfZ033f74", // ScottHermanFitness
  },

  // Shoulders (default-14 to default-18)
  "default-14": {
    // Overhead Press
    instructions: [
      "Stand with feet shoulder-width apart, core braced",
      "Hold the bar at shoulder height, grip slightly wider than shoulders",
      "Press the bar straight up, moving your head back slightly to clear the bar",
      "Lock out at the top with the bar over mid-foot",
      "Lower with control back to shoulders",
    ],
    tips: [
      "Keep your core tight - don't lean back excessively",
      "Squeeze your glutes for stability",
      "Move your head through as the bar passes your face",
      "The bar path should be as straight as possible",
    ],
    youtubeId: "2yjwXTZQDDI", // Alan Thrall
  },
  "default-15": {
    // Lateral Raises
    instructions: [
      "Stand with dumbbells at your sides, palms facing in",
      "With a slight bend in elbows, raise arms out to the sides",
      "Lift until arms are parallel to the floor",
      "Lower with control, don't just drop the weights",
      "Keep a slight forward lean for better delt engagement",
    ],
    tips: [
      "Don't go too heavy - this is an isolation exercise",
      "Lead with your elbows, not your hands",
      "Avoid shrugging your shoulders up",
      "Keep the movement slow and controlled",
    ],
    youtubeId: "3VcKaXpzqRo", // Jeff Nippard
  },
  "default-16": {
    // Front Raises
    instructions: [
      "Stand with dumbbells in front of thighs, palms facing your body",
      "Raise one or both arms straight in front of you",
      "Lift until arm is parallel to the floor or slightly higher",
      "Lower with control and repeat",
      "Alternating arms can help maintain form",
    ],
    tips: [
      "Keep a slight bend in the elbow throughout",
      "Don't swing the weights - use controlled movements",
      "Can also be done with a barbell or cable",
    ],
    youtubeId: "gzDe1JKI0k4", // ScottHermanFitness
  },
  "default-17": {
    // Face Pulls
    instructions: [
      "Set cable to upper chest or face height with rope attachment",
      "Pull the rope toward your face, separating the ends",
      "Pull your elbows high and back, externally rotating shoulders",
      "Squeeze your rear delts and upper back at the end",
      "Return with control",
    ],
    tips: [
      "This is great for shoulder health and posture",
      "Focus on external rotation - thumbs should point back at the peak",
      "Don't go too heavy - focus on the squeeze",
    ],
    youtubeId: "rep-qVOkqgk", // Jeff Cavaliere
  },
  "default-18": {
    // Arnold Press
    instructions: [
      "Sit with dumbbells at shoulder height, palms facing you",
      "Press up while rotating palms to face forward",
      "At the top, palms should face away from you",
      "Reverse the motion on the way down",
      "End with palms facing you again at shoulder height",
    ],
    tips: [
      "The rotation provides additional range of motion",
      "Keep the movement smooth and controlled",
      "Great for targeting all three delt heads",
    ],
    youtubeId: "6Z15_WdXmVw", // ScottHermanFitness
  },

  // Arms (default-19 to default-24)
  "default-19": {
    // Barbell Curl
    instructions: [
      "Stand with feet shoulder-width apart, holding barbell with underhand grip",
      "Keep elbows pinned to your sides",
      "Curl the bar up toward your shoulders",
      "Squeeze at the top, then lower with control",
      "Don't swing or use momentum",
    ],
    tips: [
      "Avoid swinging your body - keep it strict",
      "Use a shoulder-width or slightly narrower grip",
      "An EZ-bar can be easier on the wrists",
    ],
    youtubeId: "kwG2ipFRgfo", // ScottHermanFitness
  },
  "default-20": {
    // Hammer Curl
    instructions: [
      "Stand with dumbbells at sides, palms facing each other (neutral grip)",
      "Keep elbows at your sides throughout",
      "Curl the weights up, maintaining the neutral grip",
      "Squeeze at the top, then lower with control",
      "Can be done alternating or simultaneously",
    ],
    tips: [
      "Neutral grip targets the brachialis and forearms more",
      "Great for building overall arm thickness",
      "Don't let elbows drift forward",
    ],
    youtubeId: "zC3nLlEvin4", // ScottHermanFitness
  },
  "default-21": {
    // Tricep Pushdown
    instructions: [
      "Set cable to highest setting with bar or V-bar attachment",
      "Stand facing the machine, elbows pinned to your sides",
      "Push the bar down until arms are fully extended",
      "Squeeze your triceps at the bottom",
      "Return with control, stopping when forearms are parallel to floor",
    ],
    tips: [
      "Keep your elbows stationary - only your forearms should move",
      "Don't lean too far forward",
      "Try different attachments for variety",
    ],
    youtubeId: "2-LAMcpzODU", // ScottHermanFitness
  },
  "default-22": {
    // Tricep Rope Pushdown
    instructions: [
      "Attach rope to high cable pulley",
      "Grip the rope with thumbs toward the ceiling",
      "Push down and spread the rope apart at the bottom",
      "Squeeze triceps hard at the bottom",
      "Return with control",
    ],
    tips: [
      "The rope allows for greater range of motion than a bar",
      "Focus on spreading the rope apart at the bottom for peak contraction",
      "Keep elbows tucked to your sides",
    ],
    youtubeId: "kiuVA0gs3EI", // ScottHermanFitness
  },
  "default-23": {
    // Skull Crushers
    instructions: [
      "Lie on a bench holding an EZ-bar or dumbbells above your chest",
      "Keep upper arms perpendicular to the floor",
      "Bend at the elbows to lower the weight toward your forehead",
      "Stop just before touching your forehead",
      "Extend your arms back to the starting position",
    ],
    tips: [
      "Keep your upper arms stationary",
      "Lower the weight behind your head for more stretch",
      "Can be done with dumbbells or cable for variation",
    ],
    youtubeId: "d_KZxkY_0cM", // ScottHermanFitness
  },
  "default-24": {
    // Dips
    instructions: [
      "Grip parallel bars and support yourself with arms extended",
      "Keep your core tight and lean slightly forward for chest emphasis",
      "Lower yourself until upper arms are parallel to the floor or slightly below",
      "Push back up to the starting position",
      "Keep shoulders down and back",
    ],
    tips: [
      "Leaning forward targets chest more; staying upright targets triceps more",
      "If too difficult, use an assisted dip machine or resistance band",
      "Don't go too deep if you have shoulder issues",
    ],
    youtubeId: "2z8JmcrW-As", // Calisthenicmovement
  },

  // Legs (default-25 to default-36)
  "default-25": {
    // Squat
    instructions: [
      "Position bar on upper back, grip wider than shoulders",
      "Stand with feet shoulder-width apart or slightly wider, toes slightly out",
      "Brace your core and break at the hips and knees simultaneously",
      "Descend until thighs are at least parallel to the floor",
      "Drive through your whole foot to stand back up",
    ],
    tips: [
      "Keep your chest up and back flat",
      "Knees should track over toes - don't let them cave in",
      "Think about sitting back and down",
      "Keep the bar over mid-foot throughout",
    ],
    youtubeId: "bEv6CCg2BC8", // Alan Thrall
  },
  "default-26": {
    // Front Squat
    instructions: [
      "Position bar on front of shoulders, elbows high",
      "Stand with feet shoulder-width apart",
      "Keep torso more upright than back squat",
      "Descend to parallel or below",
      "Drive through heels to stand",
    ],
    tips: [
      "Keep elbows high throughout - this keeps the bar in position",
      "Front squats are more quad-dominant than back squats",
      "Work on wrist and shoulder mobility for proper rack position",
    ],
    youtubeId: "v-mQm_droHg", // Alan Thrall
  },
  "default-27": {
    // Goblet Squat
    instructions: [
      "Hold a dumbbell or kettlebell at chest height, elbows pointing down",
      "Stand with feet slightly wider than shoulder-width",
      "Squat down, keeping the weight close to your chest",
      "Elbows should pass inside your knees at the bottom",
      "Stand back up by driving through your heels",
    ],
    tips: [
      "Great for learning squat form",
      "Holding weight in front helps keep torso upright",
      "Focus on sitting between your heels",
    ],
    youtubeId: "MeIiIdhvXT4", // Alan Thrall
  },
  "default-28": {
    // Leg Press
    instructions: [
      "Sit in the machine with back against the pad",
      "Place feet shoulder-width apart on the platform",
      "Release the safety handles and lower the weight",
      "Lower until knees are at 90 degrees or slightly below",
      "Push through your heels to extend your legs",
    ],
    tips: [
      "Don't lock your knees at the top",
      "Keep your lower back pressed against the pad",
      "Foot placement affects muscle emphasis (higher = more glutes/hams)",
    ],
    youtubeId: "IZxyjW7MPJQ", // ScottHermanFitness
  },
  "default-29": {
    // Romanian Deadlift
    instructions: [
      "Stand holding barbell with overhand grip, feet hip-width apart",
      "Keeping a slight knee bend, hinge at the hips",
      "Push your hips back while lowering the bar along your legs",
      "Lower until you feel a stretch in your hamstrings",
      "Drive hips forward to return to standing",
    ],
    tips: [
      "Keep the bar close to your legs throughout",
      "Don't round your back - maintain a neutral spine",
      "Focus on the hip hinge, not bending at the knees",
    ],
    youtubeId: "jEy_czb3RKA", // Alan Thrall
  },
  "default-30": {
    // Leg Curl
    instructions: [
      "Lie face down on the leg curl machine",
      "Position the pad just above your heels",
      "Curl your heels toward your glutes",
      "Squeeze your hamstrings at the top",
      "Lower with control",
    ],
    tips: [
      "Don't swing or use momentum",
      "Point your toes for more hamstring emphasis",
      "Hold the peak contraction for 1-2 seconds",
    ],
    youtubeId: "1Tq3QdYUuHs", // ScottHermanFitness
  },
  "default-31": {
    // Seated Leg Curl
    instructions: [
      "Sit in the machine with back against the pad",
      "Position the pad just above your heels",
      "Curl your heels under the seat",
      "Squeeze your hamstrings at the peak contraction",
      "Return with control",
    ],
    tips: [
      "Seated position provides more stretch on the hamstrings",
      "Don't let the weight stack touch between reps",
      "Control the negative portion",
    ],
    youtubeId: "F488k67BTNo", // ScottHermanFitness
  },
  "default-32": {
    // Leg Extension
    instructions: [
      "Sit in the machine with back against the pad",
      "Position the pad just above your ankles",
      "Extend your legs until straight",
      "Squeeze your quads at the top",
      "Lower with control",
    ],
    tips: [
      "Don't lock your knees aggressively at the top",
      "Control the weight - don't swing",
      "Great for quad isolation and warm-up",
    ],
    youtubeId: "YyvSfVjQeL0", // ScottHermanFitness
  },
  "default-33": {
    // Standing Calf Raises
    instructions: [
      "Stand on a calf raise machine or step with balls of feet on the edge",
      "Lower your heels below the step for a full stretch",
      "Rise up on your toes as high as possible",
      "Squeeze at the top for 1-2 seconds",
      "Lower with control",
    ],
    tips: [
      "Full range of motion is key for calf development",
      "Try different foot positions (toes in, out, straight)",
      "Calves respond well to higher reps (15-20+)",
    ],
    youtubeId: "3UWi44yN-wM", // ScottHermanFitness
  },
  "default-34": {
    // Seated Calf Raises
    instructions: [
      "Sit on the machine with thighs under the pad",
      "Position balls of feet on the platform",
      "Lower heels for a full stretch",
      "Push up onto your toes",
      "Squeeze at the top, then lower with control",
    ],
    tips: [
      "Seated position targets the soleus more than standing",
      "Keep the movement controlled and deliberate",
      "Combine with standing raises for complete calf development",
    ],
    youtubeId: "JbyjNymZOt0", // ScottHermanFitness
  },
  "default-35": {
    // Lunges
    instructions: [
      "Stand with feet together",
      "Take a big step forward with one leg",
      "Lower your back knee toward the floor",
      "Front thigh should be parallel to the floor, knee over ankle",
      "Push off the front foot to return to standing",
    ],
    tips: [
      "Keep your torso upright",
      "Don't let your front knee go past your toes",
      "Can be done walking, stationary, or alternating",
    ],
    youtubeId: "QOVaHwm-Q6U", // ScottHermanFitness
  },
  "default-36": {
    // Walking Lunges
    instructions: [
      "Stand tall holding dumbbells or with bodyweight",
      "Step forward into a lunge position",
      "Lower until back knee nearly touches the ground",
      "Push through the front heel and step the back foot forward",
      "Continue walking forward, alternating legs",
    ],
    tips: [
      "Keep your core engaged for balance",
      "Take long strides for more glute engagement",
      "Keep your eyes forward, not down",
    ],
    youtubeId: "L8fvypPrzzs", // ScottHermanFitness
  },

  // Core (default-37 to default-45)
  "default-37": {
    // Plank
    instructions: [
      "Start in a forearm plank position, elbows under shoulders",
      "Keep your body in a straight line from head to heels",
      "Engage your core by pulling belly button toward spine",
      "Don't let your hips sag or pike up",
      "Hold for the target duration while breathing normally",
    ],
    tips: [
      "Squeeze your glutes to help maintain position",
      "If too difficult, drop to your knees",
      "Focus on quality over duration",
    ],
    youtubeId: "pSHjTRCQxIw", // Calisthenicmovement
  },
  "default-38": {
    // Side Plank
    instructions: [
      "Lie on your side with elbow directly under shoulder",
      "Stack your feet or stagger them for more stability",
      "Lift your hips off the ground, forming a straight line",
      "Hold while keeping your core engaged",
      "Repeat on the other side",
    ],
    tips: [
      "Don't let your hips drop or pike up",
      "For added difficulty, raise your top leg or arm",
      "Breathe normally throughout",
    ],
    youtubeId: "K2VljzCC16g", // Calisthenicmovement
  },
  "default-39": {
    // Dead Bug
    instructions: [
      "Lie on your back with arms extended toward ceiling",
      "Lift legs with knees bent at 90 degrees",
      "Press your lower back into the floor",
      "Slowly extend opposite arm and leg toward the floor",
      "Return to start and repeat on the other side",
    ],
    tips: [
      "Keep your lower back pressed into the floor throughout",
      "Move slowly and with control",
      "Exhale as you extend, inhale as you return",
    ],
    youtubeId: "I5xbsA71v1A", // Calisthenicmovement
  },
  "default-40": {
    // Bird Dog
    instructions: [
      "Start on hands and knees, hands under shoulders, knees under hips",
      "Extend one arm forward and the opposite leg back simultaneously",
      "Keep your back flat and core engaged",
      "Hold briefly, then return to start",
      "Repeat on the other side",
    ],
    tips: [
      "Don't let your hips rotate - keep them square to the floor",
      "Move slowly and with control",
      "Great for core stability and spinal health",
    ],
    youtubeId: "wiFNA3sqjCA", // Calisthenicmovement
  },
  "default-41": {
    // Bicycle Crunches
    instructions: [
      "Lie on your back with hands behind head, legs raised",
      "Bring one knee toward chest while rotating torso to touch opposite elbow to knee",
      "Extend the other leg straight out, hovering above the floor",
      "Alternate sides in a pedaling motion",
      "Keep your lower back pressed into the floor",
    ],
    tips: [
      "Focus on the rotation, not just touching elbow to knee",
      "Don't pull on your neck - support your head lightly",
      "Move with control, not speed",
    ],
    youtubeId: "9FGilxCbdz8", // ScottHermanFitness
  },
  "default-42": {
    // Crunches
    instructions: [
      "Lie on your back with knees bent, feet flat on floor",
      "Place hands behind head or across chest",
      "Curl your shoulders off the floor toward your pelvis",
      "Focus on contracting your abs, not pulling with your neck",
      "Lower with control and repeat",
    ],
    tips: [
      "Don't pull on your neck - let your abs do the work",
      "Keep your lower back on the floor",
      "The range of motion is small - quality over quantity",
    ],
    youtubeId: "Xyd_fa5zoEU", // Calisthenicmovement
  },
  "default-43": {
    // Hanging Leg Raise
    instructions: [
      "Hang from a pull-up bar with straight arms",
      "Keep your legs straight or slightly bent",
      "Raise your legs until they're parallel to the floor or higher",
      "Lower with control, avoiding swinging",
      "For increased difficulty, bring legs higher or keep them straight",
    ],
    tips: [
      "Don't swing - use controlled movements",
      "Engage your lats to stabilize",
      "If too difficult, start with knee raises",
    ],
    youtubeId: "Pr1ieGZ5atk", // Calisthenicmovement
  },
  "default-44": {
    // Russian Twist
    instructions: [
      "Sit on the floor with knees bent, feet elevated or on the ground",
      "Lean back slightly, keeping your back straight",
      "Hold a weight at your chest with both hands",
      "Rotate your torso to touch the weight to the floor on each side",
      "Keep your core engaged throughout",
    ],
    tips: [
      "Keep your back straight - don't round forward",
      "The rotation should come from your torso, not your arms",
      "For more difficulty, lift feet off the ground",
    ],
    youtubeId: "wkD8rjkodUI", // ScottHermanFitness
  },
  "default-45": {
    // Cable Woodchop
    instructions: [
      "Set cable to high or low position",
      "Stand sideways to the machine, feet wider than shoulder-width",
      "Grab the handle with both hands",
      "Rotate your torso to pull the cable diagonally across your body",
      "Control the return and repeat",
    ],
    tips: [
      "Keep your arms relatively straight - rotate from your core",
      "Pivot on your back foot during the rotation",
      "High-to-low and low-to-high variations target different areas",
    ],
    youtubeId: "pAplQXk3dkU", // ScottHermanFitness
  },

  // Cardio (default-46 to default-49)
  "default-46": {
    // Running
    instructions: [
      "Start with a proper warm-up (5 min walk or light jog)",
      "Maintain an upright posture with slight forward lean",
      "Land on midfoot, not your heels",
      "Keep arms bent at 90 degrees, swinging naturally",
      "Breathe rhythmically - find a comfortable pattern",
    ],
    tips: [
      "Start slow and build up gradually",
      "Good running shoes are essential",
      "Listen to your body and rest when needed",
      "Mix in intervals for variety and improved fitness",
    ],
    youtubeId: "brFHyOtTwH4", // The Run Experience
  },
  "default-47": {
    // Cycling
    instructions: [
      "Adjust seat height so leg is almost fully extended at the bottom",
      "Keep a slight bend in elbows, hands on handlebars",
      "Maintain a smooth, circular pedaling motion",
      "Keep your core engaged and back straight",
      "Vary resistance and cadence for different training effects",
    ],
    tips: [
      "Proper bike fit is crucial for comfort and efficiency",
      "Aim for 80-100 RPM for most training",
      "Include both steady-state and interval sessions",
    ],
    youtubeId: "H0t3XBvRBqk", // Global Triathlon Network
  },
  "default-48": {
    // Rowing
    instructions: [
      "Start with arms extended, knees bent, shins vertical (the catch)",
      "Drive with legs first, then lean back, then pull arms",
      "At the finish, legs are straight, handle at lower ribs",
      "Return in reverse: arms, lean forward, bend knees",
      "Maintain a smooth, continuous motion",
    ],
    tips: [
      "Power comes primarily from your legs (60%), then back, then arms",
      "Don't pull with arms too early - legs first!",
      "Keep your back straight throughout",
    ],
    youtubeId: "oP6OR-G7AxM", // Dark Horse Rowing
  },
  "default-49": {
    // Jump Rope
    instructions: [
      "Hold handles at hip height, elbows close to body",
      "Use wrists to turn the rope, not your arms",
      "Jump just high enough to clear the rope (1-2 inches)",
      "Land softly on the balls of your feet",
      "Keep your core engaged and body upright",
    ],
    tips: [
      "Start slow and focus on timing",
      "A good rope length: step on center, handles reach armpit",
      "Great for warm-ups, conditioning, and coordination",
      "Mix in variations like high knees, double unders",
    ],
    youtubeId: "FJmRQ5iTXKE", // Jump Rope Dudes
  },
}

// Helper function to get instructions for an exercise
export function getExerciseInstructions(exerciseId: string): ExerciseInstruction | undefined {
  return exerciseInstructions[exerciseId]
}
