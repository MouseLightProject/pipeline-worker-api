export interface IConfiguration<T> {
    development: T;
    test: T;
    production: T;
}