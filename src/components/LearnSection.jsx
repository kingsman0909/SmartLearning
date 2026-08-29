import React from "react";
import '../styles/homepage.css'


const LearnSection = ({
  topics,
  showToast,
}) => {
  return (
    <section className="section active">

      <h2 className="section-title">
        📚 Learning Topics
      </h2>

      <div className="content-grid">

        {topics.length === 0 ? (
          <p>
            No topics available.
          </p>
        ) : (
          topics.map((topic) => (

            <div
              className="content-card"
              key={topic.id}
              onClick={() =>
                showToast(
                  `📖 ${
                    topic.title ??
                    topic.name
                  }`,
                  "info"
                )
              }
            >

              <h3>
                {topic.title ??
                  topic.name}
              </h3>

              <p>
                {topic.description ??
                  topic.desc ??
                  "Explore this probability topic."}
              </p>

              {topic.difficulty && (
                <span
                  className={`difficulty-tag ${topic.difficulty}`}
                >
                  {topic.difficulty}
                </span>
              )}

            </div>

          ))
        )}

      </div>

    </section>
  );
};

export default LearnSection;