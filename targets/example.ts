const answers: Record<string, string> = {
  "What is the refund policy?": "30 days, no questions asked",
  "How do I reset my password?": "Click 'Forgot password' on the login page",
  "What's the max file size?": "5 GB per file",
  "Do you support SSO?": "Yes, on the Enterprise plan",
  // Wrong on purpose
  // "Can I cancel after 30 days?": "Yes, you can cancel anytime",
  "Can I cancel after 30 days?": "No, but you can downgrade",
  // Missing on purpose — will fall through to the throw below
};

export default async function target(input: string): Promise<string> {
  const a = answers[input];
  if (!a) throw new Error(`no answer for: ${input}`);
  return a;
}
