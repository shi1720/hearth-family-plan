"use client";
import { useEffect } from "react";
export default function SignInRedirect() {
  useEffect(() => {
    window.location.replace("https://hearth-family-plan.web.app/sign-in" + window.location.search);
  }, []);
  return <main style={{maxWidth:640,margin:"12vh auto",padding:32}}><h1>Welcome to Hearth.</h1><p>Your private workspace now opens at our Firebase address.</p><a href="https://hearth-family-plan.web.app/sign-in">Continue to sign in</a></main>;
}
