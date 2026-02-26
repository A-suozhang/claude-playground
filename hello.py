def greet(name: str = "World") -> str:
    return f"Hello, {name}!"


def main():
    print(greet())
    print(greet("Claude"))


if __name__ == "__main__":
    main()
