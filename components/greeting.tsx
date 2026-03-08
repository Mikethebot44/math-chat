import { motion } from "motion/react";
import { ChatWelcomeHeading } from "@/components/chat/chat-welcome-heading";

export const Greeting = () => (
  <div
    className="mx-auto flex size-full max-w-3xl flex-col justify-center px-8 md:mt-20"
    key="overview"
  >
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
      exit={{ opacity: 0, y: 10 }}
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: 0.5 }}
    >
      <ChatWelcomeHeading />
    </motion.div>
  </div>
);
