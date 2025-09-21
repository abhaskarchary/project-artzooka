CREATE TABLE IF NOT EXISTS prompt_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    common_prompt TEXT NOT NULL,
    imposter_prompt TEXT NOT NULL
);

INSERT INTO prompt_pairs (common_prompt, imposter_prompt) VALUES
('Draw a cat playing a guitar', 'Draw a dog playing a guitar'),
('Draw a sunny beach', 'Draw a rainy beach'),
('Draw a rocket launching', 'Draw a rocket landing'),
('Draw a birthday cake', 'Draw a wedding cake'),
('Draw a pirate ship', 'Draw a cruise ship');
