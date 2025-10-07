import React from 'react';
import Card from './Card';

interface GoalProgressCardProps {
  title: string;
  current: number;
  goal: number;
  color: string;
}

const GoalProgressCard: React.FC<GoalProgressCardProps> = ({ title, current, goal, color }) => {
  const percentage = goal > 0 ? (current / goal) * 100 : 0;
  
  return (
    <Card className="p-4 text-center animate-fade-in flex flex-col justify-between">
      <p className="text-sm font-medium text-dark-secondary h-10 flex items-center justify-center">{title}</p>
      <div className="my-2">
        <span className="text-4xl font-bold" style={{ color }}>{current}</span>
        <span className="text-2xl font-semibold text-dark-secondary">/{goal > 0 ? goal : '∞'}</span>
      </div>
      <div className="w-full bg-dark-border rounded-full h-2.5">
        <div
          className="h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
        ></div>
      </div>
    </Card>
  );
};

export default GoalProgressCard;
