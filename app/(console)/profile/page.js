"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { Panel, Button } from "@/components/ui";

const QUESTIONS = [
  { key: "reaction", q: "If your portfolio fell 15% in a week, what would you most likely do?", options: ["Hold and review", "Trim some positions", "Move mostly to cash"] },
  { key: "horizon", q: "When might you need this money?", options: ["Within 1 year", "In 1–5 years", "In 5+ years"] },
  { key: "loss", q: "What temporary portfolio loss could you tolerate before changing your plan?", options: ["Up to 5%", "About 10–15%", "More than 15%"] },
];

export default function Page() {
  const [answers, setAnswers] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((data) => {
      if (Array.isArray(data.questions)) {
        const mapped = {};
        data.questions.forEach((item) => { if (item.key) mapped[item.key] = item.answer; });
        setAnswers(mapped);
        setSaved(Object.keys(mapped).length > 0);
      }
    }).catch(() => {});
  }, []);

  async function saveProfile() {
    if (QUESTIONS.some((q) => !answers[q.key])) {
      setStatus("Please answer all three questions first.");
      return;
    }
    setLoading(true);
    setStatus("");
    const comfort = answers.loss === "Up to 5%" ? -5 : answers.loss === "About 10–15%" ? -12 : -20;
    const breaking = answers.loss === "Up to 5%" ? -10 : answers.loss === "About 10–15%" ? -18 : -30;
    try {
      const response = await fetch("/api/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comfort_threshold_pct: comfort,
          breaking_point_pct: breaking,
          reaction_style: answers.reaction,
          answers: QUESTIONS.map((q) => ({ key: q.key, question: q.q, answer: answers[q.key] })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.detail || "Could not save profile.");
      setSaved(true);
      setStatus("Your risk profile has been saved.");
    } catch (error) { setStatus(error.message || "Could not save profile."); }
    finally { setLoading(false); }
  }

  return <>
    <PageHeader title="Risk profile" description="Answer a few questions to establish your stated risk tolerance. This is a self-reported starting point, not a diagnosis or guaranteed prediction of your behaviour." />
    <div className="grid gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-8" title="Your risk preferences">
        <div className="space-y-6">
          {QUESTIONS.map((question) => <fieldset key={question.key} className="border-b border-line pb-5 last:border-0">
            <legend className="font-medium">{question.q}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {question.options.map((option) => <label key={option} className={`cursor-pointer rounded-xl border p-3 text-sm ${answers[question.key] === option ? "border-ultra bg-ultra/5" : "border-line"}`}>
                <input type="radio" name={question.key} checked={answers[question.key] === option} onChange={() => { setAnswers((current) => ({ ...current, [question.key]: option })); setSaved(false); }} className="mr-2" />
                {option}
              </label>)}
            </div>
          </fieldset>)}
          <Button onClick={saveProfile} disabled={loading}>{loading ? "Saving…" : saved ? "Update risk profile" : "Save risk profile"}</Button>
          {status && <p role="status" className="text-sm text-slate">{status}</p>}
        </div>
      </Panel>
      <Panel className="lg:col-span-4" title="How this is used">
        <p className="text-sm leading-relaxed text-slate">Your answers are stored with this local demo profile and can be used as context when reviewing crisis scenarios. The app will not invent answers on your behalf.</p>
        {saved && <p className="mt-4 rounded-lg bg-mint/10 p-3 text-sm">Profile saved. Revisit this page to update your answers.</p>}
      </Panel>
    </div>
    <NextSteps href="/profile" />
  </>;
}
