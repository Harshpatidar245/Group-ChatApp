"use client";
import Link from "next/link";

export default function AuthSection() {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[80vh] px-4">
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg bg-white border border-gray-200 shadow-xl rounded-3xl p-8 sm:p-10 text-center">
        <h2 className="text-3xl font-extrabold text-gray-800 mb-3">
          Welcome to <span className="text-blue-600">ChatApp</span>
        </h2>
        <p className="text-gray-500 text-base mb-8">
          Sign in or create an account to start chatting instantly.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link href="/login" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md active:scale-95">
              Login
            </button>
          </Link>
          <Link href="/register" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-all shadow-md active:scale-95">
              Register
            </button>
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-400">
          By continuing, you agree to our{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
          .
        </div>
      </div>
    </div>
  );
}
