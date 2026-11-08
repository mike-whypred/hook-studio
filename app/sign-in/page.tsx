import SignInForm from "./sign-in-form";

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const { mode } = await searchParams;
  return <SignInForm initialMode={mode === "up" ? "up" : "in"} />;
}
