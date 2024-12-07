import {Context, Markup, Telegraf} from "telegraf";
import * as dotenv from "dotenv";
import {Category, Question, Session, Status} from "./models";
import {SessionsRepositoryInterface} from "./storage/storage";
import {RedisSessionRepository} from "./storage/redis";
import {categories} from "./fixtures";
import cloneDeep from "lodash/cloneDeep";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const token = process.env.TG_TOKEN || "";
const bot = new Telegraf<Context>(token);

let repository: SessionsRepositoryInterface;


(async () => {
    try {
        repository = new RedisSessionRepository();
    } catch (error) {
        console.error("Error:", error);
    }
    await bot.telegram.setMyCommands([
        {command: 'help', description: 'Что это?'},
        {command: 'menu', description: 'Главное меню'},
        {command: 'progress', description: 'Твой текущий счет в бинго'},
        {command: 'bingo', description: 'Завершить Бинго!'},
    ]);
})();

const startMessage = `Бдыщ! — тут захватывающее новогоднее бинго, где ты сможешь испытать себя в стиле популярного телешоу "Своя игра"!
        
Правила просты: отвечай на вопросы, и как только ты справишься со всеми, то тебя ждет "Новогоднее Бинго!" ⭐️

Если вдруг вопросы из категории "душница" начнут тебя утомлять, просто набери команду /bingo, и получишь свой результат мгновенно.

Удачи в охоте за знаниями и новогодними сюрпризами!
🎄🎄🎄`

const drawStatusIcon = (s: Status, text: string): string => {
    if (s == Status.Correct) {
        return `${text} ✅`;
    } else if (s == Status.Wrong) {
        return `   `;
    } else {
        return `${text}`;
    }
};

const defaultRows = 4;

const chunk = <T>(array: T[], chunkSize: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
    }
    return result;
};

const computeScore = (s: Session): number => {
    return s.categories.reduce((totalPoints, category) => {
        const categoryPoints = category.questions.reduce(
            (sum, question) => sum + (question.status === Status.Correct ? 1 : 0) * question.points,
            0,
        );
        return totalPoints + categoryPoints;
    }, 0);
};

const sumScore = () => {
    return categories.reduce((totalPoints, category) => {
        const categoryPoints = category.questions.reduce(
            (sum, question) => sum + question.points,
            0,
        );
        return totalPoints + categoryPoints;
    }, 0);
}

const computeCategoryCompleted = (cat: Category): number => {
    return cat.questions.reduce(
        (sum, question) => sum + (question.status === Status.Correct || question.status === Status.Wrong ? 1 : 0), 0,
    );
}

const computeCategoryCorrected = (cat: Category): number => {
    return cat.questions.reduce(
        (sum, question) => sum + (question.status === Status.Correct ? 1 : 0), 0,
    );
}

const checkDone = (s: Session): boolean => {
    const done = s.categories.find((c: Category) => c.questions.find((q: Question) => q.status === Status.Created))

    return typeof done === 'undefined'
}

const findInProgress = (s: Session): Question | undefined => {
    let question: Question | undefined
    s.categories.forEach((c: Category) => {
        const q = c.questions.find((q: Question) => q.status === Status.InProgress)
        if (q) {
            question = q
        }
    })

    return question
}

const computeBingo = (s: Session): { image: string, status: string } => {
    const score = computeScore(s);

    const beginner = `от 0 до 8192.
Твой талисман на будущий год - это чилловый парень!

К трудностям ты относишься с некоторой долей иронии. Все заботы могут подожать до завтра, главное не пропустить Новый Год!

В новом 2025 ты увидишь себя в комфортной обстановке, окруженный вкусными печеньками и прочими радостями жизни. Твой спокойный подход позволит тебе решать все задачи, избегая лишнего стресса с легкой улыбкой!
`;
    const novice = `от 8192 до 16384. Твоим талисманом стал Астро Бой.
В этом году ты много старался и превозмогал, лишения закалили тебя, твой живой ум завел тебя в такие приключения, что и не снились твоим друзьям.

Ты со смелостью будешь вступать в новые приключения в следующем году! Однако, как и Астро Бою тебе понадобится крепкая рука наставника рядом!`;

    const junior = `от 16384 до 20480. Твой талисман - это Акира.
    
Ты разрываешь шаблоны и щелкаешь задачки у уме. В тебе сочетается страсть к приключениеям и невероятные умственные способности, ты, подобно своему персонажу врываешься в проблемы и разбираешься с ними на ходу.

В следующем году тебя ждут невероятные по сложности проекты, за которым придет заслуженная плата!`

    const middle = `от 20480 до 24576. Твой талисман - это HAL-9000 из Космической Одиссеи.
    
Ты аналитическая машина, твой ум и хладнокровие трудно померить человеческими мерками. Ты пытаешься познать тайны Вселенной и понять человеческую природу.

В следующем году ты продолжишь постигать тайны мироздания, а также решать еще более сложные и интеллектуальные головоломки. Тебя не пугают запутанные условия, ведь ты распутываешь любые хитросплетения за сотые доли секунд!`

    const senior = `от 24576 до 28672. Твой талисман - это профессор Дамблдор!
    
Ты достиг вершины мастерства в своем деле и готов вкладывать мудрость в новые поколения. Твоя мудрость и живость ума вдохновляет юные дарования на свершения и подвиги, о которых ты готов рассказать за кружечкой пшеничного эля.

В следующем году ты будешь пожинать плоды своего творчества и готовить новых апологетов к геройской жизни. Твоя жизнь будет наполнена новыми открытиями, приятными встречами и волшебством!`;

    const staff = `от 28672 до 33000. Твой талисман - это Рик из Рик и Морти!

Ты даже не напрягался в процессе прохождения бинго, в этот момент ты наизусть цитировал геометрию Лобачевского и перемножал матрицы 1000 на 1000 чтобы не заснуть. Все, что тебе нужно дается играючи, все твои действия ради рофла и веселья. Ты прирожденный наглец!

В следующем году тебя ждут невероятные приключения, так как такая натура не может сидеть без дела. Ты бросишь судьбе все возможные вызовы и выиграешь, как и всегда, ведь ты не привык проигрывать! Ну и удача на стороне смелых!`;


    switch (true) {
        case score > 0 && score < 8192:
            return {
                image: path.join(__dirname, "../public/567d13a7c41e11efaad3569cafd5b679_1.jpeg"),
                status: beginner,
            }
        case score >= 8192 && score < 16384:
            return {
                image: path.join(__dirname, "../public/724f29abc41e11ef806876600e133400_1.jpeg"),
                status: novice,
            }
        case score >= 16384 && score < 20480:
            return {
                image: path.join(__dirname, "../public/5813a9bfc41f11ef9b9a96abdde39816_1.jpeg"),
                status: junior,
            }
        case score >= 20480 && score < 24576:
            return {
                image: path.join(__dirname, "../public/220e5c7bc42011ef806876600e133400_1.jpeg"),
                status: middle,
            }
        case score >= 24576 && score < 28672:
            return {
                image: path.join(__dirname, "../public/f786a257c42011ef84662e6086dc6f13_1.jpeg"),
                status: senior
            }
        case score >= 28672 && score <= 33000:
            return {
                image: path.join(__dirname, "../public/39ee9adcc4ca11efa27aca1a2988ea3c_1.jpeg"),
                status: staff
            }
        default:
            return {
                image: path.join(__dirname, "../public/567d13a7c41e11efaad3569cafd5b679_1.jpeg"),
                status: beginner,
            };
    }
};

bot.on("poll_answer", async (ctx) => {
    try {
        const pollAnswer = ctx.update.poll_answer;
        const userId = ctx.from.id;
        const optionIds = pollAnswer.option_ids;

        const session = await repository.findSessionByUserId(userId);
        if (!session) {
            ctx.reply("Упс, что-то пошло не так");
            console.log(`session not found for user ${ctx.from.id}`);
            return;
        }

        const chatId = session.chatId;

        let currentQuestion: Question | null = null;
        let categoryIdx: number = -1;

        for (const [index, c] of session.categories.entries()) {
            const q = c.questions.find(
                (q: Question) => q.pollId === pollAnswer.poll_id,
            );
            if (q) {
                currentQuestion = q;
                categoryIdx = index;
                break;
            }
        }

        if (!currentQuestion) {
            console.log(
                `question with answer poll id ${pollAnswer.poll_id} not found for user ${ctx.from.id}`,
            );
            return;
        }

        const currentCategory = session.categories[categoryIdx];

        currentQuestion.answer = optionIds[0];
        currentQuestion.status = Status.Wrong;
        if (optionIds.length > 0) {
            currentQuestion.status =
                currentQuestion.correctIndex == currentQuestion.answer
                    ? Status.Correct
                    : Status.Wrong;
        }

        await repository.saveSession(session);


        if (checkDone(session)) {
            const bingo = computeBingo(session)

            ctx.telegram.sendPhoto(
                chatId,
                {source: fs.createReadStream(bingo.image)},
                {caption: bingo.status}
            );
            return
        }

        if (chatId) {
            const questions = currentCategory.questions;
            const chunkedQuestions = chunk(questions, defaultRows);
            ctx.telegram.sendMessage(session.chatId, `${currentCategory.categoryName}. ${currentCategory.description}`, {
                reply_markup: Markup.inlineKeyboard(
                    chunkedQuestions
                        .map((questionChunk) =>
                            questionChunk.map((q: Question) =>
                                Markup.button.callback(
                                    drawStatusIcon(q.status, `${q.points.toString()}`),
                                    `category_${currentCategory.categoryName}_question_${q.points}`,
                                ),
                            ),
                        )
                        .concat([[Markup.button.callback(`назад`, `categories`)]]),
                ).reply_markup,
            });
        }
    } catch (e) {
        ctx.reply("Упс, что-то пошло не так");
        console.log(e);
    }
});

bot.action("categories", async (ctx) => {
    ctx.answerCbQuery("Категории");
    try {
        const session = await repository.findSessionByUserId(ctx.from.id);
        if (!session) {
            ctx.reply("Упс, что-то пошло не так");
            console.log(`session not found for user ${ctx.from.id}`);
            return;
        }

        const chunked = chunk(session.categories, 1);

        ctx.editMessageText("Выбирай категорию!", {
            reply_markup: Markup.inlineKeyboard(
                chunked.map((chunk) =>
                    chunk.map((c: Category) =>
                        Markup.button.callback(
                            drawCategoryText(c.categoryName, c),
                            `category_${c.categoryName}`,
                        ),
                    ),
                ),
            ).reply_markup,
        });
    } catch (e) {
        ctx.reply("Упс, что-то пошло не так");
        console.log(e);
    }
});

categories.forEach((c: Category) => {
    bot.action(`category_${c.categoryName}`, async (ctx) => {
        ctx.answerCbQuery(`Ты выбрал категорию ${c.categoryName}`);

        c.questions.forEach((q: Question) => {
            bot.action(
                `category_${c.categoryName}_question_${q.points}`,
                async (ctx) => {
                    const session = await repository.findSessionByUserId(ctx.from.id);
                    if (!session) {
                        ctx.reply("Упс, что-то пошло не так");
                        console.log(`session not found for user ${ctx.from.id}`);
                        return;
                    }

                    const found = findInProgress(session)
                    if (found && found.question !== q.question) {
                        ctx.answerCbQuery(`Завершите предыдущую игру`);
                        return;
                    }

                    const chatId = session.chatId;

                    const currentCategory = session.categories.find(
                        (cat: Category) => cat.categoryName === c.categoryName,
                    );
                    if (!currentCategory) {
                        ctx.reply("Упс, что-то пошло не так");
                        console.log(
                            `category ${c.categoryName} not found for user ${ctx.from.id}`,
                        );
                        return;
                    }

                    const currentQuestion = currentCategory.questions.find(
                        (qus: Question) => qus.points === q.points,
                    );
                    if (!currentQuestion) {
                        ctx.reply("Упс, что-то пошло не так");
                        console.log(
                            `question ${q.question} not found for user ${ctx.from.id}`,
                        );
                        return;
                    }

                    if (currentQuestion.status !== Status.Created || currentQuestion.pollId !== "") {
                        console.log(JSON.stringify(currentQuestion));
                        ctx.answerCbQuery(`Это событие нельзя начать`);
                        return;
                    }

                    ctx.answerCbQuery(`Ты выбрал вопрос с ${q.points}`);

                    const answer = await ctx.sendQuiz(
                        currentQuestion.question,
                        currentQuestion.options,
                        {
                            correct_option_id: currentQuestion.correctIndex,
                            is_anonymous: false,
                            open_period: currentQuestion.duration,
                        },
                    );

                    currentQuestion.pollId = answer.poll.id;
                    currentQuestion.status = Status.InProgress;
                    await repository.saveSession(session);

                    setTimeout(
                        async () => {
                            try {
                                const session = await repository.findSessionByUserId(ctx.from.id);
                                if (!session) {
                                    ctx.reply("Упс, что-то пошло не так");
                                    console.log(`session not found for user ${ctx.from.id}`);
                                    return;
                                }

                                const currentCategory = session.categories.find(
                                    (cat: Category) => cat.categoryName === c.categoryName,
                                );
                                if (!currentCategory) {
                                    ctx.reply("Упс, что-то пошло не так");
                                    console.log(
                                        `category ${c.categoryName} not found for user ${ctx.from.id}`,
                                    );
                                    return;
                                }

                                const currentQuestion = currentCategory.questions.find(
                                    (qus: Question) => qus.points === q.points,
                                );
                                if (!currentQuestion) {
                                    ctx.reply("Упс, что-то пошло не так");
                                    console.log(
                                        `question ${q.question} not found for user ${ctx.from.id}`,
                                    );
                                    return;
                                }

                                if (currentQuestion.status !== Status.InProgress) {
                                    return
                                }

                                currentQuestion.status = Status.Wrong;
                                await repository.saveSession(session);

                                if (checkDone(session)) {
                                    const bingo = computeBingo(session)

                                    ctx.telegram.sendPhoto(
                                        chatId,
                                        {source: fs.createReadStream(bingo.image)},
                                        {caption: bingo.status}
                                    );
                                    return
                                }

                                const questions = currentCategory.questions;
                                const chunkedQuestions = chunk(questions, defaultRows);

                                ctx.telegram.sendMessage(session.chatId, `${currentCategory.categoryName}. ${currentCategory.description}`, {
                                    reply_markup: Markup.inlineKeyboard(
                                        chunkedQuestions
                                            .map((questionChunk) =>
                                                questionChunk.map((q: Question) =>
                                                    Markup.button.callback(
                                                        drawStatusIcon(q.status, `${q.points.toString()}`),
                                                        `category_${currentCategory.categoryName}_question_${q.points}`,
                                                    ),
                                                ),
                                            )
                                            .concat([
                                                [Markup.button.callback(`назад`, `categories`)],
                                            ]),
                                    ).reply_markup,
                                });
                            } catch (e) {
                                ctx.reply("Упс, что-то пошло не так");
                                console.log(e);
                            }
                        }, (currentQuestion.duration + 1) * 1000,
                    );
                },
            );
        });

        const session = await repository.findSessionByUserId(ctx.from.id);
        if (!session) {
            ctx.reply("Упс, что-то пошло не так");
            console.log(`session not found for user ${ctx.from.id}`);
            return;
        }

        const currentCategory = session.categories.find(
            (cat: Category) => cat.categoryName === c.categoryName,
        );
        if (!currentCategory) {
            ctx.reply("Упс, что-то пошло не так");
            console.log(
                `category ${c.categoryName} not found for user ${ctx.from.id}`,
            );
            return;
        }

        const questions = currentCategory.questions;
        const chunkedQuestions = chunk(questions, defaultRows);

        ctx.editMessageText(`${c.categoryName}. ${c.description}`, {
            reply_markup: Markup.inlineKeyboard(
                chunkedQuestions
                    .map((questionChunk) =>
                        questionChunk.map((q: Question) =>
                            Markup.button.callback(
                                drawStatusIcon(q.status, `${q.points.toString()}`),
                                `category_${currentCategory.categoryName}_question_${q.points}`,
                            ),
                        ),
                    )
                    .concat([[Markup.button.callback(`назад`, `categories`)]]),
            ).reply_markup,
        });
    });
});

const playButtonName = "Играть";

bot.action(playButtonName, async (ctx) => {
    ctx.answerCbQuery("Категории");

    try {
        const session = await repository.findSessionByUserId(ctx.from.id);
        if (!session) {
            ctx.reply("Упс, что-то пошло не так");
            console.log(`session not found for user ${ctx.from.id}`);
            return;
        }

        const chunked = chunk(session.categories, 1);

        ctx.editMessageText("Выбирай категорию!", {
            reply_markup: Markup.inlineKeyboard(
                chunked.map((chunk) =>
                    chunk.map((c: Category) =>
                        Markup.button.callback(
                            drawCategoryText(c.categoryName, c),
                            `category_${c.categoryName}`,
                        ),
                    ),
                ),
            ).reply_markup,
        });
    } catch (e) {
        ctx.reply("Упс, что-то пошло не так");
        console.log(e);
    }
});


const drawCategoryText = (text: string, c: Category): string => {
    const completed = computeCategoryCompleted(c);
    const corrected = computeCategoryCorrected(c);
    const escapeMarkdown = (text: string): string => {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    };


    switch (true) {
        case completed > 0 && completed === c.questions.length && completed === corrected:
            return `💎 ${Array.from(text).slice(1).join('')}`;
        case completed > 0 && completed === c.questions.length:
            return `🎯 ${Array.from(text).slice(1).join('')}`;
        case completed > 0:
            return `${completed}/${c.questions.length} ${escapeMarkdown(text)}`;
        default:
            return escapeMarkdown(text);
    }
}

bot.command("menu", async (ctx) => {
    const session = await repository.findSessionByUserId(ctx.from.id);
    if (!session) {
        ctx.reply("Упс, что-то пошло не так");
        console.log(`session not found for user ${ctx.from.id}`);
        return;
    }

    const chunked = chunk(session.categories, 1);


    ctx.reply("Выбирай категорию!", {
        reply_markup: Markup.inlineKeyboard(
            chunked.map((chunk) =>
                chunk.map((c: Category) =>
                    Markup.button.callback(
                        drawCategoryText(c.categoryName, c),
                        `category_${c.categoryName}`,
                    ),
                ),
            ),
        ).reply_markup,
    });
});


bot.command("bingo", async (ctx) => {
    const session = await repository.findSessionByUserId(ctx.from.id);
    if (!session) {
        ctx.reply("Упс, что-то пошло не так");
        console.log(`session not found for user ${ctx.from.id}`);
        return;
    }

    const chatId = session.chatId;

    const bingo = computeBingo(session)

    ctx.telegram.sendPhoto(
        chatId,
        {source: fs.createReadStream(bingo.image)},
        {caption: bingo.status}
    );
});

bot.command("progress", async (ctx) => {
    const session = await repository.findSessionByUserId(ctx.from.id);
    if (!session) {
        ctx.reply("Упс, что-то пошло не так");
        console.log(`session not found for user ${ctx.from.id}`);
        return;
    }

    const score = computeScore(session);

    ctx.reply(`Твой текущий счёт в бинго: ${score} / ${sumScore()}`);
});

bot.command("help", (ctx) => {
    ctx.reply(`${startMessage}
    
Список команд: 
/help - описание игры и список команд
/menu - вывести все категории
/progress - твой текущий счет в бинго!
/bingo - получить бинго прямо сейчас!
`);
});

bot.use((ctx, next) => {
    if (ctx.chat?.type === 'private') {
        return next();
    }
});

bot.start(async (ctx) => {
    const {id, first_name} = ctx.message.from;
    const chatId = ctx.chat.id;

    const _ = await repository.saveSession({
        user: {
            id: id,
            firstName: first_name,
        },
        chatId: chatId,
        categories: cloneDeep(categories),
    });

    ctx.reply(startMessage, Markup.inlineKeyboard([
            Markup.button.callback(playButtonName, playButtonName),
        ]),
    );
});

bot.launch().then((r) => console.log("bot has been started"));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
