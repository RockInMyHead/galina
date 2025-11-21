"""
Пример использования GPT-5.1 в Галине
По аналогии с предоставленным кодом
"""

from openai import OpenAI

def ask_gpt51(prompt: str, *, reasoning: str = "medium") -> str:
    """
    Функция для общения с GPT-5.1

    Args:
        prompt: Текст запроса
        reasoning: Уровень рассуждений ('low', 'medium', 'high')

    Returns:
        str: Ответ от GPT-5.1
    """
    client = OpenAI()

    resp = client.responses.create(
        model="gpt-5.1",
        reasoning={"effort": reasoning},
        input=[
            {"role": "system", "content": "Ты - Галина, опытный AI-юрист с глубокими знаниями российского законодательства. Отвечай структурировано и профессионально."},
            {"role": "user", "content": prompt},
        ],
    )
    return resp.output[0].content[0].text.strip()


if __name__ == "__main__":
    # Примеры использования
    print("=== Тестирование GPT-5.1 ===")

    # Пример 1: Простой юридический вопрос
    print("\n1. Простой вопрос:")
    response = ask_gpt51("Что такое трудовой договор?")
    print(response)

    # Пример 2: С высоким уровнем рассуждений
    print("\n2. Сложный юридический анализ:")
    response = ask_gpt51(
        "Объясни последствия нарушения условий договора поставки для обеих сторон",
        reasoning="high"
    )
    print(response)

    # Пример 3: Быстрый ответ
    print("\n3. Быстрый ответ:")
    response = ask_gpt51(
        "Какие документы нужны для регистрации ООО?",
        reasoning="low"
    )
    print(response)

