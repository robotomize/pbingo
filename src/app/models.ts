export type User = {
  id: number;
  firstName: string;
};

export enum Status {
  Correct = "correct",
  Wrong = "wrong",
  Created = "created",
  InProgress = "inProgress"
}

export type Question = {
  pollId: string;
  question: string;
  points: number;
  status: Status;
  answer: number;
  duration: number;
  correctIndex: number;
  options: string[];
};

export type Category = {
  categoryName: string;
  description: string;
  questions: Question[];
};

export type Session = {
  user: User;
  chatId: number;
  categories: Category[];
};
