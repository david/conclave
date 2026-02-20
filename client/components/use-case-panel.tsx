import React from "react";
import type { UseCase } from "../reducer.ts";

function UseCaseCard({ useCase, index }: { useCase: UseCase; index: number }) {
  return (
    <div
      className="uc-card"
      data-priority={useCase.priority}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="uc-card__topline">
        <span className="uc-card__id">{useCase.id}</span>
        <span className={`uc-card__badge uc-card__badge--${useCase.priority}`}>
          {useCase.priority}
        </span>
      </div>

      <h3 className="uc-card__name">{useCase.name}</h3>

      <div className="uc-card__meta">
        <span className="uc-card__actor">{useCase.actor}</span>
      </div>

      <p className="uc-card__summary">{useCase.summary}</p>

      <div className="uc-card__scenario">
        <div className="uc-card__clause">
          <span className="uc-card__clause-keyword">Given</span>
          <ul className="uc-card__clause-items">
            {useCase.given.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="uc-card__clause">
          <span className="uc-card__clause-keyword">When</span>
          <ul className="uc-card__clause-items">
            {useCase.when.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="uc-card__clause">
          <span className="uc-card__clause-keyword">Then</span>
          <ul className="uc-card__clause-items">
            {useCase.then.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </div>

      {useCase.dependencies && useCase.dependencies.length > 0 && (
        <div className="uc-card__deps">
          <span className="uc-card__deps-label">Depends on</span>
          <span className="uc-card__deps-list">
            {useCase.dependencies.map((dep, i) => (
              <span key={dep} className="uc-card__dep-id">{dep}</span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

type UseCasePanelProps = {
  useCases: UseCase[];
};

export function UseCasePanel({ useCases }: UseCasePanelProps) {
  return (
    <div className="uc-panel">
      <header className="uc-panel__header">
        <span className="uc-panel__label">Use Cases</span>
        <span className="uc-panel__count">{useCases.length}</span>
      </header>
      <div className="uc-panel__scroll">
        <div className="uc-panel__grid">
          {useCases.map((uc, i) => (
            <UseCaseCard key={uc.id} useCase={uc} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
